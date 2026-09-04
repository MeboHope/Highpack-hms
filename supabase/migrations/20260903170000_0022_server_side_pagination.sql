/* HighPark Consult — server-side pagination for large operational ledgers. */
CREATE OR REPLACE FUNCTION public.get_managed_expenses_page(p_page integer DEFAULT 1, p_page_size integer DEFAULT 20)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_is_admin boolean := false; v_page integer := GREATEST(1, p_page); v_size integer := LEAST(100, GREATEST(1, p_page_size)); v_offset integer := (v_page - 1) * v_size; v_total bigint; v_amount numeric;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'You must be signed in'; END IF;
 SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=v_user AND role='admin') INTO v_is_admin;
 IF NOT v_is_admin AND NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=v_user AND role IN ('owner','agent')) THEN RAISE EXCEPTION 'You are not allowed to view expenses'; END IF;
 SELECT count(*), coalesce(sum(e.amount),0) INTO v_total,v_amount FROM public.expenses e JOIN public.properties pr ON pr.id=e.property_id WHERE v_is_admin OR pr.owner_id=v_user OR e.owner_id=v_user;
 RETURN jsonb_build_object('total_count',v_total,'total_amount',v_amount,'rows',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',x.id,'property_id',x.property_id,'owner_id',x.owner_id,'category',x.category,'amount',x.amount,'expense_date',x.expense_date,'vendor',x.vendor,'description',x.description,'receipt_url',x.receipt_url,'payment_method',x.payment_method,'created_at',x.created_at,'property_name',x.property_name) ORDER BY x.expense_date DESC,x.created_at DESC) FROM (SELECT e.*, coalesce(pr.name,'Property') AS property_name FROM public.expenses e JOIN public.properties pr ON pr.id=e.property_id WHERE v_is_admin OR pr.owner_id=v_user OR e.owner_id=v_user ORDER BY e.expense_date DESC,e.created_at DESC OFFSET v_offset LIMIT v_size) x),'[]'::jsonb));
END; $$;
REVOKE ALL ON FUNCTION public.get_managed_expenses_page(integer,integer) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.get_managed_expenses_page(integer,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_managed_maintenance_page(p_page integer DEFAULT 1, p_page_size integer DEFAULT 20)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_admin boolean := false; v_page integer := GREATEST(1,p_page); v_size integer := LEAST(100,GREATEST(1,p_page_size)); v_offset integer := (v_page-1)*v_size; v_total bigint;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'You must be signed in'; END IF;
 SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=v_user AND role='admin') INTO v_admin;
 IF NOT v_admin AND NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=v_user AND role IN ('owner','agent')) THEN RAISE EXCEPTION 'You are not allowed to view maintenance requests'; END IF;
 SELECT count(*) INTO v_total FROM public.maintenance_requests mr JOIN public.properties pr ON pr.id=mr.property_id WHERE v_admin OR pr.owner_id=v_user;
 RETURN jsonb_build_object('total_count',v_total,'rows',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',x.id,'tenant_id',x.tenant_id,'property_id',x.property_id,'unit_id',x.unit_id,'category',x.category,'description',x.description,'priority',x.priority,'status',x.status,'created_at',x.created_at,'updated_at',x.updated_at,'property_name',x.property_name,'unit_number',x.unit_number,'tenant_name',x.tenant_name,'tenant_phone',x.tenant_phone) ORDER BY x.created_at DESC) FROM (SELECT mr.*, coalesce(pr.name,'Property') AS property_name, coalesce(pu.unit_number,'—') AS unit_number, p.full_name AS tenant_name, p.phone AS tenant_phone FROM public.maintenance_requests mr JOIN public.properties pr ON pr.id=mr.property_id LEFT JOIN public.property_units pu ON pu.id=mr.unit_id LEFT JOIN public.profiles p ON p.id=mr.tenant_id WHERE v_admin OR pr.owner_id=v_user ORDER BY mr.created_at DESC OFFSET v_offset LIMIT v_size) x),'[]'::jsonb));
END; $$;
REVOKE ALL ON FUNCTION public.get_managed_maintenance_page(integer,integer) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.get_managed_maintenance_page(integer,integer) TO authenticated;
NOTIFY pgrst, 'reload schema';
