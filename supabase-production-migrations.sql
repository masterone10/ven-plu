-- =============================================================================
-- VEN+ Supabase Consolidated Production Migrations
-- Generated from current supabase/migrations in exact chronological order
-- =============================================================================

-- =============================================================================
-- MIGRATION FILE: 20260824100023_91c2f867-4bff-4f5b-bedc-dd191d2f76e9.sql
-- =============================================================================

-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('CUSTOMER', 'ADMIN');
CREATE TYPE public.payment_method AS ENUM ('CASH', 'POINTS');
CREATE TYPE public.order_funding_mode AS ENUM ('CASH_ONLY', 'POINTS_ONLY', 'MIXED');
CREATE TYPE public.order_status AS ENUM ('PENDING_CONFIRMATION','CONFIRMED','PROCESSING','SHIPPED','DELIVERED','CANCELLED');
CREATE TYPE public.points_transaction_type AS ENUM (
  'EARN_PURCHASE','EARN_REFERRAL','REDEEM_PRODUCT','REDEEM_SHIPPING',
  'REFUND_PRODUCT_REDEMPTION','REFUND_SHIPPING_REDEMPTION','ADJUSTMENT_CREDIT','ADJUSTMENT_DEBIT'
);

-- ============ SHARED TRIGGER FN ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  locale TEXT NOT NULL DEFAULT 'ar',
  referral_code TEXT NOT NULL UNIQUE,
  referred_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "profiles_select_own_or_admin" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'ADMIN'));
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own_or_admin" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'ADMIN'))
  WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "user_roles_select_own_or_admin" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'ADMIN'));

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- referral attribution + referral code are immutable after creation
CREATE OR REPLACE FUNCTION public.guard_referral_immutability()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.referral_code IS DISTINCT FROM OLD.referral_code THEN
    RAISE EXCEPTION 'referral_code is immutable';
  END IF;
  IF NEW.referred_by IS DISTINCT FROM OLD.referred_by THEN
    RAISE EXCEPTION 'referral attribution is immutable';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER profiles_referral_immutable BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_referral_immutability();

CREATE OR REPLACE FUNCTION public.guard_self_referral()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.referred_by IS NOT NULL AND NEW.referred_by = NEW.id THEN
    RAISE EXCEPTION 'self-referral is not allowed';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER profiles_no_self_referral BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_self_referral();

-- ============ POINTS ============
CREATE TABLE public.points_balances (
  user_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.points_balances TO authenticated;
GRANT ALL ON public.points_balances TO service_role;
ALTER TABLE public.points_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "points_balances_select_own_or_admin" ON public.points_balances FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'ADMIN'));

CREATE TABLE public.points_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  delta INTEGER NOT NULL CHECK (delta <> 0),
  type public.points_transaction_type NOT NULL,
  order_id UUID,
  source_reference TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  related_transaction_id UUID REFERENCES public.points_transactions(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX points_transactions_user_created_idx ON public.points_transactions (user_id, created_at DESC);
CREATE INDEX points_transactions_order_idx ON public.points_transactions (order_id);
GRANT SELECT ON public.points_transactions TO authenticated;
GRANT ALL ON public.points_transactions TO service_role;
ALTER TABLE public.points_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "points_transactions_select_own_or_admin" ON public.points_transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'ADMIN'));

-- ledger is append-only: block updates/deletes for everyone including service_role
CREATE OR REPLACE FUNCTION public.guard_points_ledger_immutable()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'points_transactions is append-only; create a compensating transaction instead';
END; $$;
CREATE TRIGGER points_transactions_no_update BEFORE UPDATE OR DELETE ON public.points_transactions
  FOR EACH ROW EXECUTE FUNCTION public.guard_points_ledger_immutable();

-- single authoritative, idempotent points mutation entry point
CREATE OR REPLACE FUNCTION public.apply_points_transaction(
  _user_id UUID,
  _delta INTEGER,
  _type public.points_transaction_type,
  _idempotency_key TEXT,
  _order_id UUID DEFAULT NULL,
  _source_reference TEXT DEFAULT NULL,
  _related_transaction_id UUID DEFAULT NULL,
  _note TEXT DEFAULT NULL
) RETURNS TABLE (transaction_id UUID, balance INTEGER, created BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _existing public.points_transactions;
  _new_id UUID;
  _balance INTEGER;
BEGIN
  IF _delta = 0 THEN RAISE EXCEPTION 'points delta must be non-zero'; END IF;
  IF _idempotency_key IS NULL OR length(trim(_idempotency_key)) = 0 THEN
    RAISE EXCEPTION 'idempotency key is required';
  END IF;

  SELECT * INTO _existing FROM public.points_transactions WHERE idempotency_key = _idempotency_key;
  IF FOUND THEN
    SELECT b.balance INTO _balance FROM public.points_balances b WHERE b.user_id = _existing.user_id;
    RETURN QUERY SELECT _existing.id, COALESCE(_balance, 0), FALSE;
    RETURN;
  END IF;

  INSERT INTO public.points_balances (user_id, balance)
  VALUES (_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT b.balance INTO _balance FROM public.points_balances b WHERE b.user_id = _user_id FOR UPDATE;

  IF _balance + _delta < 0 THEN
    RAISE EXCEPTION 'insufficient points balance: have %, requested %', _balance, _delta;
  END IF;

  INSERT INTO public.points_transactions
    (user_id, delta, type, order_id, source_reference, idempotency_key, related_transaction_id, note)
  VALUES (_user_id, _delta, _type, _order_id, _source_reference, _idempotency_key, _related_transaction_id, _note)
  RETURNING id INTO _new_id;

  UPDATE public.points_balances
     SET balance = _balance + _delta, updated_at = now()
   WHERE user_id = _user_id
  RETURNING points_balances.balance INTO _balance;

  RETURN QUERY SELECT _new_id, _balance, TRUE;
END; $$;
REVOKE ALL ON FUNCTION public.apply_points_transaction(UUID, INTEGER, public.points_transaction_type, TEXT, UUID, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_points_transaction(UUID, INTEGER, public.points_transaction_type, TEXT, UUID, TEXT, UUID, TEXT) TO service_role;

-- ============ NEW USER BOOTSTRAP ============
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _code TEXT;
BEGIN
  LOOP
    _code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = _code);
  END LOOP;
  RETURN _code;
END; $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _referrer UUID;
  _incoming TEXT;
BEGIN
  _incoming := nullif(trim(upper(NEW.raw_user_meta_data ->> 'referral_code')), '');
  IF _incoming IS NOT NULL THEN
    SELECT id INTO _referrer FROM public.profiles WHERE referral_code = _incoming;
    IF _referrer = NEW.id THEN _referrer := NULL; END IF;
  END IF;

  INSERT INTO public.profiles (id, full_name, phone, locale, referral_code, referred_by)
  VALUES (
    NEW.id,
    nullif(trim(NEW.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(NEW.raw_user_meta_data ->> 'phone'), ''),
    COALESCE(nullif(trim(NEW.raw_user_meta_data ->> 'locale'), ''), 'ar'),
    public.generate_referral_code(),
    _referrer
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'CUSTOMER')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.points_balances (user_id, balance) VALUES (NEW.id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ CATALOG ============
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories_public_read" ON public.categories FOR SELECT TO anon, authenticated USING (is_active);
CREATE POLICY "categories_admin_all" ON public.categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN')) WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));
CREATE TRIGGER categories_updated_at BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  description_en TEXT,
  description_ar TEXT,
  cash_price NUMERIC(12,2) NOT NULL CHECK (cash_price >= 0),
  points_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  default_points_price INTEGER CHECK (default_points_price IS NULL OR default_points_price >= 0),
  delivery_points_reward INTEGER NOT NULL DEFAULT 0 CHECK (delivery_points_reward >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX products_category_idx ON public.products (category_id);
CREATE INDEX products_active_idx ON public.products (is_active);
GRANT SELECT ON public.products TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_public_read" ON public.products FOR SELECT TO anon, authenticated USING (is_active);
CREATE POLICY "products_admin_all" ON public.products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN')) WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));
CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sku TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  cash_price NUMERIC(12,2) CHECK (cash_price IS NULL OR cash_price >= 0),
  points_price INTEGER CHECK (points_price IS NULL OR points_price >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX product_variants_product_idx ON public.product_variants (product_id);
GRANT SELECT ON public.product_variants TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_variants TO authenticated;
GRANT ALL ON public.product_variants TO service_role;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_variants_public_read" ON public.product_variants FOR SELECT TO anon, authenticated USING (is_active);
CREATE POLICY "product_variants_admin_all" ON public.product_variants FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN')) WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));
CREATE TRIGGER product_variants_updated_at BEFORE UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  alt_en TEXT,
  alt_ar TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX product_images_product_idx ON public.product_images (product_id);
CREATE INDEX product_images_variant_idx ON public.product_images (variant_id);
GRANT SELECT ON public.product_images TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_images TO authenticated;
GRANT ALL ON public.product_images TO service_role;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_images_public_read" ON public.product_images FOR SELECT TO anon, authenticated USING (TRUE);
CREATE POLICY "product_images_admin_all" ON public.product_images FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN')) WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));

-- ============ STORE SETTINGS ============
CREATE TABLE public.store_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  global_shipping_price NUMERIC(12,2) NOT NULL DEFAULT 80.00 CHECK (global_shipping_price >= 0),
  shipping_points_price INTEGER NOT NULL DEFAULT 400 CHECK (shipping_points_price >= 0),
  free_shipping_points_threshold INTEGER NOT NULL DEFAULT 0 CHECK (free_shipping_points_threshold >= 0),
  expected_delivery_duration TEXT NOT NULL DEFAULT '2-5 days',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.store_settings TO anon, authenticated;
GRANT INSERT, UPDATE ON public.store_settings TO authenticated;
GRANT ALL ON public.store_settings TO service_role;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "store_settings_public_read" ON public.store_settings FOR SELECT TO anon, authenticated USING (TRUE);
CREATE POLICY "store_settings_admin_write" ON public.store_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN')) WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));
CREATE TRIGGER store_settings_updated_at BEFORE UPDATE ON public.store_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO public.store_settings (id, global_shipping_price, shipping_points_price, free_shipping_points_threshold, expected_delivery_duration)
VALUES (TRUE, 80.00, 400, 0, '2-5 days');

-- ============ CART ============
CREATE TABLE public.carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.carts TO authenticated;
GRANT ALL ON public.carts TO service_role;
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "carts_own_all" ON public.carts FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER carts_updated_at BEFORE UPDATE ON public.carts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  product_payment_method public.payment_method NOT NULL DEFAULT 'CASH',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cart_id, variant_id)
);
CREATE INDEX cart_items_cart_idx ON public.cart_items (cart_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cart_items TO authenticated;
GRANT ALL ON public.cart_items TO service_role;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cart_items_own_all" ON public.cart_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.carts c WHERE c.id = cart_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.carts c WHERE c.id = cart_id AND c.user_id = auth.uid()));
CREATE TRIGGER cart_items_updated_at BEFORE UPDATE ON public.cart_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ ORDERS ============
CREATE SEQUENCE public.order_number_seq START 1000;
GRANT USAGE, SELECT ON SEQUENCE public.order_number_seq TO service_role;

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE DEFAULT ('VP-' || nextval('public.order_number_seq')::text),
  user_id UUID REFERENCES auth.users ON DELETE SET NULL,
  created_by_admin UUID REFERENCES auth.users ON DELETE SET NULL,
  status public.order_status NOT NULL DEFAULT 'PENDING_CONFIRMATION',
  funding_mode public.order_funding_mode NOT NULL,
  shipping_payment_method public.payment_method NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  shipping_address JSONB NOT NULL DEFAULT '{}'::jsonb,
  shipping_cash_price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (shipping_cash_price >= 0),
  shipping_points_price INTEGER NOT NULL DEFAULT 0 CHECK (shipping_points_price >= 0),
  cash_total NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (cash_total >= 0),
  points_total INTEGER NOT NULL DEFAULT 0 CHECK (points_total >= 0),
  expected_delivery_duration TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  confirmed_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  purchase_reward_granted BOOLEAN NOT NULL DEFAULT FALSE,
  referral_reward_granted BOOLEAN NOT NULL DEFAULT FALSE,
  points_refunded BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX orders_user_created_idx ON public.orders (user_id, created_at DESC);
CREATE INDEX orders_status_idx ON public.orders (status);
GRANT SELECT, INSERT, UPDATE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders_select_own_or_admin" ON public.orders FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'ADMIN'));
CREATE POLICY "orders_admin_write" ON public.orders FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN')) WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  product_name_en TEXT NOT NULL,
  product_name_ar TEXT NOT NULL,
  variant_name_en TEXT NOT NULL,
  variant_name_ar TEXT NOT NULL,
  sku TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  product_payment_method public.payment_method NOT NULL,
  unit_cash_price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (unit_cash_price >= 0),
  unit_points_price INTEGER NOT NULL DEFAULT 0 CHECK (unit_points_price >= 0),
  line_cash_total NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (line_cash_total >= 0),
  line_points_total INTEGER NOT NULL DEFAULT 0 CHECK (line_points_total >= 0),
  delivery_points_reward INTEGER NOT NULL DEFAULT 0 CHECK (delivery_points_reward >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX order_items_order_idx ON public.order_items (order_id);
GRANT SELECT, INSERT ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_items_select_own_or_admin" ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id
                 AND (o.user_id = auth.uid() OR public.has_role(auth.uid(), 'ADMIN'))));
CREATE POLICY "order_items_admin_write" ON public.order_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN')) WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));

ALTER TABLE public.points_transactions
  ADD CONSTRAINT points_transactions_order_fk FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;

-- =============================================================================
-- MIGRATION FILE: 20260824100055_ce92cf07-0b85-40f9-ae2f-88f71861e1cb.sql
-- =============================================================================

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_referral_code() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated, service_role;

-- =============================================================================
-- MIGRATION FILE: 20260824100502_2d01f2ab-451f-49fd-ba4e-bcd290f5e450.sql
-- =============================================================================

CREATE OR REPLACE FUNCTION public.referral_code_exists(_code TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE referral_code = upper(_code)
  );
$$;

REVOKE ALL ON FUNCTION public.referral_code_exists(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.referral_code_exists(TEXT) TO anon, authenticated, service_role;

-- =============================================================================
-- MIGRATION FILE: 20260824100515_44505efb-01e1-454c-ba24-1e8768f0b992.sql
-- =============================================================================

REVOKE EXECUTE ON FUNCTION public.referral_code_exists(TEXT) FROM anon;

-- =============================================================================
-- MIGRATION FILE: 20260824110204_1f63c578-e356-4f48-a277-ab52b0718e0f.sql
-- =============================================================================

-- Work Item 1: checkout + points. Funding modes remain CASH_ONLY / POINTS_ONLY only.

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS idempotency_fingerprint TEXT;

-- ---------------------------------------------------------------------------
-- Atomic checkout: server recalculates everything, no client-supplied amounts.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.checkout_place_order(
  _user_id UUID,
  _idempotency_key TEXT,
  _customer_name TEXT,
  _customer_phone TEXT,
  _shipping_address JSONB,
  _shipping_payment_method payment_method,
  _fingerprint TEXT
)
RETURNS TABLE(order_id UUID, order_number TEXT, created BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _key TEXT;
  _existing public.orders;
  _settings public.store_settings;
  _balance INTEGER;
  _cart_id UUID;
  _item RECORD;
  _has_cash BOOLEAN := FALSE;
  _has_points BOOLEAN := FALSE;
  _cash_items NUMERIC(12,2) := 0;
  _points_items INTEGER := 0;
  _shipping_cash NUMERIC(12,2) := 0;
  _shipping_points INTEGER := 0;
  _funding order_funding_mode;
  _unit_cash NUMERIC(12,2);
  _unit_points INTEGER;
  _new_id UUID;
  _new_number TEXT;
  _item_count INTEGER := 0;
BEGIN
  -- 01/02 actor identity is established by the caller (authenticated server fn).
  IF _user_id IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  IF _idempotency_key IS NULL OR length(trim(_idempotency_key)) < 8 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR' USING DETAIL = 'idempotency key is required';
  END IF;
  IF _customer_name IS NULL OR length(trim(_customer_name)) < 2 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR' USING DETAIL = 'customer name is required';
  END IF;
  IF _customer_phone IS NULL OR _customer_phone !~ '^01[0-9]{9}$' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR' USING DETAIL = 'valid Egyptian mobile number is required';
  END IF;

  _key := _user_id::text || ':' || trim(_idempotency_key);

  -- 24 idempotency: same key + same request replays, different request conflicts.
  SELECT * INTO _existing FROM public.orders o WHERE o.idempotency_key = _key;
  IF FOUND THEN
    IF _existing.user_id IS DISTINCT FROM _user_id
       OR _existing.idempotency_fingerprint IS DISTINCT FROM _fingerprint THEN
      RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';
    END IF;
    RETURN QUERY SELECT _existing.id, _existing.order_number, FALSE;
    RETURN;
  END IF;

  -- 25 concurrency protection: serialise checkout per customer.
  PERFORM pg_advisory_xact_lock(hashtextextended(_user_id::text, 0));

  SELECT * INTO _settings FROM public.store_settings WHERE id;
  IF NOT FOUND THEN RAISE EXCEPTION 'INTERNAL_ERROR' USING DETAIL = 'store settings missing'; END IF;

  INSERT INTO public.points_balances (user_id, balance) VALUES (_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;
  SELECT b.balance INTO _balance FROM public.points_balances b WHERE b.user_id = _user_id;

  -- 03/04 authoritative cart
  SELECT c.id INTO _cart_id FROM public.carts c WHERE c.user_id = _user_id;
  IF _cart_id IS NULL THEN RAISE EXCEPTION 'CART_EMPTY'; END IF;

  -- 05..21 authoritative catalog values, locked against concurrent stock changes
  FOR _item IN
    SELECT ci.id AS cart_item_id, ci.quantity, ci.product_payment_method,
           v.id AS variant_id, v.sku, v.name_en AS v_name_en, v.name_ar AS v_name_ar,
           v.cash_price AS v_cash, v.points_price AS v_points, v.stock, v.is_active AS v_active,
           p.id AS product_id, p.name_en AS p_name_en, p.name_ar AS p_name_ar,
           p.cash_price AS p_cash, p.points_enabled, p.default_points_price,
           p.delivery_points_reward, p.is_active AS p_active
      FROM public.cart_items ci
      JOIN public.product_variants v ON v.id = ci.variant_id
      JOIN public.products p ON p.id = v.product_id
     WHERE ci.cart_id = _cart_id
     ORDER BY ci.created_at
     FOR UPDATE OF v
  LOOP
    _item_count := _item_count + 1;
    IF NOT _item.p_active THEN RAISE EXCEPTION 'PRODUCT_INACTIVE' USING DETAIL = _item.sku; END IF;
    IF NOT _item.v_active THEN RAISE EXCEPTION 'VARIANT_INACTIVE' USING DETAIL = _item.sku; END IF;
    IF _item.quantity IS NULL OR _item.quantity <= 0 THEN
      RAISE EXCEPTION 'INVALID_QUANTITY' USING DETAIL = _item.sku;
    END IF;
    IF _item.stock < _item.quantity THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK' USING DETAIL = _item.sku;
    END IF;

    _unit_cash := COALESCE(_item.v_cash, _item.p_cash);
    _unit_points := NULL;

    IF _item.product_payment_method = 'POINTS' THEN
      IF NOT _item.points_enabled THEN
        RAISE EXCEPTION 'POINTS_NOT_ENABLED' USING DETAIL = _item.sku;
      END IF;
      _unit_points := COALESCE(_item.v_points, _item.default_points_price);
      IF _unit_points IS NULL THEN
        RAISE EXCEPTION 'POINTS_PRICE_UNAVAILABLE' USING DETAIL = _item.sku;
      END IF;
      _has_points := TRUE;
      _points_items := _points_items + (_unit_points * _item.quantity);
    ELSE
      IF _unit_cash IS NULL THEN
        RAISE EXCEPTION 'INTERNAL_ERROR' USING DETAIL = 'missing cash price';
      END IF;
      _has_cash := TRUE;
      _cash_items := _cash_items + (_unit_cash * _item.quantity);
    END IF;
  END LOOP;

  IF _item_count = 0 THEN RAISE EXCEPTION 'CART_EMPTY'; END IF;

  -- 15..17 shipping configuration
  IF _shipping_payment_method = 'POINTS' THEN
    _shipping_points := _settings.shipping_points_price;
    _shipping_cash := 0;
    _has_points := TRUE;
  ELSE
    _shipping_cash := _settings.global_shipping_price;
    _shipping_points := 0;
    IF _shipping_cash > 0 THEN _has_cash := TRUE; END IF;
  END IF;

  -- 22 aggregate funding mode: CASH_ONLY, POINTS_ONLY, or MIXED
  IF _has_cash AND _has_points THEN
    _funding := 'MIXED';
  ELSIF _has_points THEN
    _funding := 'POINTS_ONLY';
  ELSE
    _funding := 'CASH_ONLY';
  END IF;

  -- 23 points balance
  IF (_points_items + _shipping_points) > _balance THEN
    RAISE EXCEPTION 'INSUFFICIENT_POINTS';
  END IF;

  -- 28 immutable order snapshot
  INSERT INTO public.orders (
    user_id, status, funding_mode, shipping_payment_method,
    customer_name, customer_phone, shipping_address,
    shipping_cash_price, shipping_points_price,
    cash_total, points_total, expected_delivery_duration,
    idempotency_key, idempotency_fingerprint
  ) VALUES (
    _user_id, 'PENDING_CONFIRMATION', _funding, _shipping_payment_method,
    trim(_customer_name), _customer_phone, COALESCE(_shipping_address, '{}'::jsonb),
    _shipping_cash, _shipping_points,
    _cash_items + _shipping_cash, _points_items + _shipping_points,
    _settings.expected_delivery_duration, _key, _fingerprint
  )
  RETURNING id, orders.order_number INTO _new_id, _new_number;

  -- 29 order items with frozen values, 26 stock deduction
  FOR _item IN
    SELECT ci.quantity, ci.product_payment_method,
           v.id AS variant_id, v.sku, v.name_en AS v_name_en, v.name_ar AS v_name_ar,
           v.cash_price AS v_cash, v.points_price AS v_points,
           p.id AS product_id, p.name_en AS p_name_en, p.name_ar AS p_name_ar,
           p.cash_price AS p_cash, p.default_points_price, p.delivery_points_reward
      FROM public.cart_items ci
      JOIN public.product_variants v ON v.id = ci.variant_id
      JOIN public.products p ON p.id = v.product_id
     WHERE ci.cart_id = _cart_id
     ORDER BY ci.created_at
  LOOP
    _unit_cash := CASE WHEN _item.product_payment_method = 'CASH'
                       THEN COALESCE(_item.v_cash, _item.p_cash) ELSE 0 END;
    _unit_points := CASE WHEN _item.product_payment_method = 'POINTS'
                         THEN COALESCE(_item.v_points, _item.default_points_price) ELSE 0 END;

    INSERT INTO public.order_items (
      order_id, product_id, variant_id,
      product_name_en, product_name_ar, variant_name_en, variant_name_ar, sku,
      quantity, product_payment_method,
      unit_cash_price, unit_points_price, line_cash_total, line_points_total,
      delivery_points_reward
    ) VALUES (
      _new_id, _item.product_id, _item.variant_id,
      _item.p_name_en, _item.p_name_ar, _item.v_name_en, _item.v_name_ar, _item.sku,
      _item.quantity, _item.product_payment_method,
      _unit_cash, _unit_points,
      _unit_cash * _item.quantity, _unit_points * _item.quantity,
      _item.delivery_points_reward
    );

    UPDATE public.product_variants
       SET stock = stock - _item.quantity
     WHERE id = _item.variant_id;
  END LOOP;

  -- 27/30 points debits through the append-only ledger
  IF _points_items > 0 THEN
    PERFORM public.apply_points_transaction(
      _user_id, -_points_items, 'REDEEM_PRODUCT',
      'REDEEM_PRODUCT:' || _new_id::text, _new_id, 'order:' || _new_id::text, NULL, NULL);
  END IF;
  IF _shipping_points > 0 THEN
    PERFORM public.apply_points_transaction(
      _user_id, -_shipping_points, 'REDEEM_SHIPPING',
      'REDEEM_SHIPPING:' || _new_id::text, _new_id, 'order:' || _new_id::text, NULL, NULL);
  END IF;

  DELETE FROM public.cart_items WHERE cart_id = _cart_id;

  RETURN QUERY SELECT _new_id, _new_number, TRUE;
END; $$;

REVOKE ALL ON FUNCTION public.checkout_place_order(UUID, TEXT, TEXT, TEXT, JSONB, payment_method, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.checkout_place_order(UUID, TEXT, TEXT, TEXT, JSONB, payment_method, TEXT) TO service_role;

-- ---------------------------------------------------------------------------
-- Cancellation compensation: restore stock, refund redemptions via new ledger rows.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_order_with_compensation(_order_id UUID, _actor_id UUID)
RETURNS TABLE(order_id UUID, refunded_points INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _order public.orders;
  _refund INTEGER := 0;
  _item RECORD;
BEGIN
  SELECT * INTO _order FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_STATE_CONFLICT' USING DETAIL = 'order not found'; END IF;
  IF _order.user_id IS DISTINCT FROM _actor_id AND NOT public.has_role(_actor_id, 'ADMIN') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF _order.status NOT IN ('PENDING_CONFIRMATION', 'CONFIRMED', 'PROCESSING') THEN
    RAISE EXCEPTION 'ORDER_STATE_CONFLICT' USING DETAIL = _order.status::text;
  END IF;

  FOR _item IN SELECT variant_id, quantity FROM public.order_items WHERE order_id = _order_id LOOP
    IF _item.variant_id IS NOT NULL THEN
      UPDATE public.product_variants SET stock = stock + _item.quantity WHERE id = _item.variant_id;
    END IF;
  END LOOP;

  IF NOT _order.points_refunded AND _order.user_id IS NOT NULL THEN
    SELECT COALESCE(SUM(line_points_total), 0) INTO _refund
      FROM public.order_items WHERE order_id = _order_id;
    IF _refund > 0 THEN
      PERFORM public.apply_points_transaction(
        _order.user_id, _refund, 'REFUND_PRODUCT_REDEMPTION',
        'REFUND_PRODUCT_REDEMPTION:' || _order_id::text, _order_id,
        'order:' || _order_id::text, NULL, 'cancellation compensation');
    END IF;
    IF _order.shipping_points_price > 0 THEN
      PERFORM public.apply_points_transaction(
        _order.user_id, _order.shipping_points_price, 'REFUND_SHIPPING_REDEMPTION',
        'REFUND_SHIPPING_REDEMPTION:' || _order_id::text, _order_id,
        'order:' || _order_id::text, NULL, 'cancellation compensation');
      _refund := _refund + _order.shipping_points_price;
    END IF;
  END IF;

  UPDATE public.orders
     SET status = 'CANCELLED', cancelled_at = now(), points_refunded = TRUE
   WHERE id = _order_id;

  RETURN QUERY SELECT _order_id, _refund;
END; $$;

REVOKE ALL ON FUNCTION public.cancel_order_with_compensation(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_order_with_compensation(UUID, UUID) TO service_role;

-- ---------------------------------------------------------------------------
-- Delivery reward hook: purchase points + 50-point referral, DELIVERED only, once.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_delivery_rewards(_order_id UUID)
RETURNS TABLE(purchase_points INTEGER, referral_points INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _order public.orders;
  _purchase INTEGER := 0;
  _referral INTEGER := 0;
  _referrer UUID;
  _earlier BOOLEAN;
BEGIN
  SELECT * INTO _order FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_STATE_CONFLICT' USING DETAIL = 'order not found'; END IF;
  IF _order.status <> 'DELIVERED' THEN
    RETURN QUERY SELECT 0, 0;
    RETURN;
  END IF;
  IF _order.user_id IS NULL THEN
    RETURN QUERY SELECT 0, 0;
    RETURN;
  END IF;

  IF NOT _order.purchase_reward_granted THEN
    SELECT COALESCE(SUM(delivery_points_reward * quantity), 0) INTO _purchase
      FROM public.order_items WHERE order_id = _order_id;
    IF _purchase > 0 THEN
      PERFORM public.apply_points_transaction(
        _order.user_id, _purchase, 'EARN_PURCHASE',
        'EARN_PURCHASE:' || _order_id::text, _order_id,
        'order:' || _order_id::text, NULL, NULL);
    END IF;
    UPDATE public.orders SET purchase_reward_granted = TRUE WHERE id = _order_id;
  END IF;

  IF NOT _order.referral_reward_granted THEN
    SELECT referred_by INTO _referrer FROM public.profiles WHERE id = _order.user_id;
    IF _referrer IS NOT NULL AND _referrer <> _order.user_id THEN
      SELECT EXISTS (
        SELECT 1 FROM public.orders o
         WHERE o.user_id = _order.user_id
           AND o.id <> _order_id
           AND o.status = 'DELIVERED'
           AND o.referral_reward_granted
      ) INTO _earlier;
      IF NOT _earlier THEN
        PERFORM public.apply_points_transaction(
          _referrer, 50, 'EARN_REFERRAL',
          'EARN_REFERRAL:' || _order.user_id::text, _order_id,
          'referee:' || _order.user_id::text, NULL, NULL);
        _referral := 50;
      END IF;
    END IF;
    UPDATE public.orders SET referral_reward_granted = TRUE WHERE id = _order_id;
  END IF;

  RETURN QUERY SELECT _purchase, _referral;
END; $$;

REVOKE ALL ON FUNCTION public.apply_delivery_rewards(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_delivery_rewards(UUID) TO service_role;

-- ---------------------------------------------------------------------------
-- Demo catalog so cart and checkout have authoritative data to operate on.
-- ---------------------------------------------------------------------------
INSERT INTO public.categories (id, slug, name_en, name_ar, sort_order) VALUES
  ('11111111-1111-4111-8111-111111111101', 'skincare', 'Skincare', 'العناية بالبشرة', 1),
  ('11111111-1111-4111-8111-111111111102', 'haircare', 'Haircare', 'العناية بالشعر', 2),
  ('11111111-1111-4111-8111-111111111103', 'accessories', 'Accessories', 'الإكسسوارات', 3)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.products (id, slug, category_id, name_en, name_ar, description_en, description_ar, cash_price, points_enabled, default_points_price, delivery_points_reward) VALUES
  ('22222222-2222-4222-8222-222222222201', 'vitamin-c-serum', '11111111-1111-4111-8111-111111111101', 'Vitamin C Serum', 'سيروم فيتامين سي', 'Brightening serum for daily use.', 'سيروم لتفتيح البشرة للاستخدام اليومي.', 480.00, TRUE, 900, 40),
  ('22222222-2222-4222-8222-222222222202', 'hydrating-moisturizer', '11111111-1111-4111-8111-111111111101', 'Hydrating Moisturizer', 'كريم مرطب', 'Lightweight daily moisturizer.', 'كريم مرطب خفيف للاستخدام اليومي.', 350.00, TRUE, 700, 30),
  ('22222222-2222-4222-8222-222222222203', 'sunscreen-spf50', '11111111-1111-4111-8111-111111111101', 'Sunscreen SPF 50', 'واقي شمس SPF 50', 'Broad spectrum sun protection.', 'حماية واسعة من الشمس.', 420.00, FALSE, NULL, 35),
  ('22222222-2222-4222-8222-222222222204', 'argan-hair-oil', '11111111-1111-4111-8111-111111111102', 'Argan Hair Oil', 'زيت الأرغان للشعر', 'Nourishing oil for dry hair.', 'زيت مغذٍ للشعر الجاف.', 260.00, TRUE, 520, 20),
  ('22222222-2222-4222-8222-222222222205', 'repair-shampoo', '11111111-1111-4111-8111-111111111102', 'Repair Shampoo', 'شامبو إصلاح', 'Sulfate-free repair shampoo.', 'شامبو إصلاح بدون سلفات.', 195.00, TRUE, 400, 15),
  ('22222222-2222-4222-8222-222222222206', 'silk-scrunchie-set', '11111111-1111-4111-8111-111111111103', 'Silk Scrunchie Set', 'طقم توكات حرير', 'Set of three silk scrunchies.', 'طقم من ثلاث توكات حرير.', 150.00, TRUE, 300, 10),
  ('22222222-2222-4222-8222-222222222207', 'ceramic-mug', '11111111-1111-4111-8111-111111111103', 'Ceramic Mug', 'مج سيراميك', 'Handmade ceramic mug, 350ml.', 'مج سيراميك يدوي، 350 مل.', 180.00, TRUE, 360, 12),
  ('22222222-2222-4222-8222-222222222208', 'cotton-tote-bag', '11111111-1111-4111-8111-111111111103', 'Cotton Tote Bag', 'شنطة قطن', 'Reusable cotton tote.', 'شنطة قطن قابلة لإعادة الاستخدام.', 220.00, FALSE, NULL, 18)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.product_variants (id, product_id, sku, name_en, name_ar, cash_price, points_price, stock) VALUES
  ('33333333-3333-4333-8333-333333333301', '22222222-2222-4222-8222-222222222201', 'VC-SER-30', '30 ml', '30 مل', 480.00, 900, 25),
  ('33333333-3333-4333-8333-333333333302', '22222222-2222-4222-8222-222222222201', 'VC-SER-50', '50 ml', '50 مل', 690.00, 1300, 12),
  ('33333333-3333-4333-8333-333333333303', '22222222-2222-4222-8222-222222222202', 'HM-MOI-50', '50 ml', '50 مل', 350.00, 700, 30),
  ('33333333-3333-4333-8333-333333333304', '22222222-2222-4222-8222-222222222203', 'SS-SPF-50', '50 ml', '50 مل', 420.00, NULL, 18),
  ('33333333-3333-4333-8333-333333333305', '22222222-2222-4222-8222-222222222204', 'AR-OIL-100', '100 ml', '100 مل', 260.00, 520, 22),
  ('33333333-3333-4333-8333-333333333306', '22222222-2222-4222-8222-222222222205', 'RS-SHA-300', '300 ml', '300 مل', 195.00, 400, 40),
  ('33333333-3333-4333-8333-333333333307', '22222222-2222-4222-8222-222222222206', 'SC-SET-BLK', 'Black', 'أسود', 150.00, 300, 35),
  ('33333333-3333-4333-8333-333333333308', '22222222-2222-4222-8222-222222222206', 'SC-SET-BRN', 'Brown', 'بني', 150.00, 300, 28),
  ('33333333-3333-4333-8333-333333333309', '22222222-2222-4222-8222-222222222207', 'CM-MUG-350', '350 ml', '350 مل', 180.00, 360, 26),
  ('33333333-3333-4333-8333-333333333310', '22222222-2222-4222-8222-222222222208', 'CT-TOT-STD', 'Standard', 'مقاس واحد', 220.00, NULL, 31)
ON CONFLICT (sku) DO NOTHING;

INSERT INTO public.product_images (product_id, variant_id, url, alt_en, alt_ar, sort_order, is_primary) VALUES
  ('22222222-2222-4222-8222-222222222201', NULL, 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800&q=80', 'Vitamin C serum bottle', 'زجاجة سيروم فيتامين سي', 0, TRUE),
  ('22222222-2222-4222-8222-222222222202', NULL, 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&q=80', 'Moisturizer jar', 'برطمان كريم مرطب', 0, TRUE),
  ('22222222-2222-4222-8222-222222222203', NULL, 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=800&q=80', 'Sunscreen tube', 'أنبوب واقي شمس', 0, TRUE),
  ('22222222-2222-4222-8222-222222222204', NULL, 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=800&q=80', 'Argan hair oil bottle', 'زجاجة زيت أرغان', 0, TRUE),
  ('22222222-2222-4222-8222-222222222205', NULL, 'https://images.unsplash.com/photo-1585232004423-244e0e6904e3?w=800&q=80', 'Shampoo bottle', 'زجاجة شامبو', 0, TRUE),
  ('22222222-2222-4222-8222-222222222206', NULL, 'https://images.unsplash.com/photo-1522338242992-e1a54906a8da?w=800&q=80', 'Silk scrunchies', 'توكات حرير', 0, TRUE),
  ('22222222-2222-4222-8222-222222222207', NULL, 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=800&q=80', 'Ceramic mug', 'مج سيراميك', 0, TRUE),
  ('22222222-2222-4222-8222-222222222208', NULL, 'https://images.unsplash.com/photo-1591561954557-26941169b49e?w=800&q=80', 'Cotton tote bag', 'شنطة قطن', 0, TRUE);

-- =============================================================================
-- MIGRATION FILE: 20260824125912_9179a48b-bac4-4913-be56-597d3535305f.sql
-- =============================================================================

DROP FUNCTION IF EXISTS public.cancel_order_with_compensation(uuid, uuid);

CREATE FUNCTION public.cancel_order_with_compensation(_order_id uuid, _actor_id uuid)
 RETURNS TABLE(cancelled_order_id uuid, refunded_points integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _order public.orders;
  _refund INTEGER := 0;
  _item RECORD;
BEGIN
  SELECT * INTO _order FROM public.orders o WHERE o.id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_STATE_CONFLICT' USING DETAIL = 'order not found'; END IF;
  IF _order.user_id IS DISTINCT FROM _actor_id AND NOT public.has_role(_actor_id, 'ADMIN') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF _order.status NOT IN ('PENDING_CONFIRMATION', 'CONFIRMED', 'PROCESSING') THEN
    RAISE EXCEPTION 'ORDER_STATE_CONFLICT' USING DETAIL = _order.status::text;
  END IF;

  FOR _item IN
    SELECT oi.variant_id AS variant_id, oi.quantity AS quantity
      FROM public.order_items oi
     WHERE oi.order_id = _order_id
  LOOP
    IF _item.variant_id IS NOT NULL THEN
      UPDATE public.product_variants pv
         SET stock = pv.stock + _item.quantity
       WHERE pv.id = _item.variant_id;
    END IF;
  END LOOP;

  IF NOT _order.points_refunded AND _order.user_id IS NOT NULL THEN
    SELECT COALESCE(SUM(oi.line_points_total), 0) INTO _refund
      FROM public.order_items oi WHERE oi.order_id = _order_id;
    IF _refund > 0 THEN
      PERFORM public.apply_points_transaction(
        _order.user_id, _refund, 'REFUND_PRODUCT_REDEMPTION',
        'REFUND_PRODUCT_REDEMPTION:' || _order_id::text, _order_id,
        'order:' || _order_id::text, NULL, 'cancellation compensation');
    END IF;
    IF _order.shipping_points_price > 0 THEN
      PERFORM public.apply_points_transaction(
        _order.user_id, _order.shipping_points_price, 'REFUND_SHIPPING_REDEMPTION',
        'REFUND_SHIPPING_REDEMPTION:' || _order_id::text, _order_id,
        'order:' || _order_id::text, NULL, 'cancellation compensation');
      _refund := _refund + _order.shipping_points_price;
    END IF;
  END IF;

  UPDATE public.orders o
     SET status = 'CANCELLED', cancelled_at = now(), points_refunded = TRUE
   WHERE o.id = _order_id;

  RETURN QUERY SELECT _order_id, _refund;
END; $function$;

REVOKE ALL ON FUNCTION public.cancel_order_with_compensation(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_order_with_compensation(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_order_with_compensation(uuid, uuid) TO service_role;

