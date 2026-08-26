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