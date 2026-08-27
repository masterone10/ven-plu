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