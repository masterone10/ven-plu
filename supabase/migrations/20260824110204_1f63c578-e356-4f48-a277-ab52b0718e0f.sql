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

  -- 15..17 shipping configuration + eligibility
  IF _shipping_payment_method = 'POINTS' THEN
    IF _balance < _settings.free_shipping_points_threshold THEN
      RAISE EXCEPTION 'SHIPPING_POINTS_NOT_ELIGIBLE';
    END IF;
    _shipping_points := _settings.shipping_points_price;
    _shipping_cash := 0;
    _has_points := TRUE;
  ELSE
    _shipping_cash := _settings.global_shipping_price;
    _shipping_points := 0;
    IF _shipping_cash > 0 THEN _has_cash := TRUE; END IF;
  END IF;

  -- 22 aggregate funding mode: CASH_ONLY or POINTS_ONLY, never mixed
  IF _has_cash AND _has_points THEN
    RAISE EXCEPTION 'VALIDATION_ERROR'
      USING DETAIL = 'an order must be entirely cash or entirely points';
  END IF;
  _funding := CASE WHEN _has_points THEN 'POINTS_ONLY' ELSE 'CASH_ONLY' END;

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