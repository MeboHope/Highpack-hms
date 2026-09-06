/*
  HighPark Consult — Phase 6: Document & Compliance Centre
  Secure private document storage, metadata, review workflow and audit trail.
*/

-- Repair notification table privileges used by the Admin Activity & Alerts centre.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.notifications TO authenticated;

CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL DEFAULT 'other' CHECK (category IN ('lease','identity','property','financial','tax','maintenance','compliance','other')),
  status text NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review','verified','rejected','expired','archived')),
  file_name text NOT NULL,
  mime_type text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0 CHECK (file_size >= 0),
  storage_path text NOT NULL UNIQUE,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  lease_id uuid REFERENCES public.leases(id) ON DELETE SET NULL,
  tenant_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  uploaded_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_created_at ON public.documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_property ON public.documents(property_id);
CREATE INDEX IF NOT EXISTS idx_documents_lease ON public.documents(lease_id);
CREATE INDEX IF NOT EXISTS idx_documents_tenant ON public.documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON public.documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_documents_category_status ON public.documents(category, status);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "documents_select_authorized" ON public.documents;
CREATE POLICY "documents_select_authorized" ON public.documents FOR SELECT TO authenticated
USING (
  uploaded_by = auth.uid()
  OR tenant_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = documents.property_id AND p.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

DROP POLICY IF EXISTS "documents_insert_self" ON public.documents;
CREATE POLICY "documents_insert_self" ON public.documents FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('customer','owner','agent','admin'))
);

DROP POLICY IF EXISTS "documents_update_authorized" ON public.documents;
CREATE POLICY "documents_update_authorized" ON public.documents FOR UPDATE TO authenticated
USING (
  uploaded_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = documents.property_id AND p.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
)
WITH CHECK (
  uploaded_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = documents.property_id AND p.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "documents_delete_authorized" ON public.documents;
CREATE POLICY "documents_delete_authorized" ON public.documents FOR DELETE TO authenticated
USING (
  uploaded_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = documents.property_id AND p.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

DROP TRIGGER IF EXISTS documents_set_updated_at ON public.documents;
CREATE TRIGGER documents_set_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Reuse the Phase 5 audit mechanism if present.
DROP TRIGGER IF EXISTS documents_audit_trigger ON public.documents;
CREATE TRIGGER documents_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.capture_audit_log();

-- Private bucket. Access is granted through document metadata authorization below.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pms-documents', 'pms-documents', false, 10485760,
  ARRAY[
    'application/pdf','image/jpeg','image/png','image/webp',
    'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 10485760;

DROP POLICY IF EXISTS "pms_documents_insert" ON storage.objects;
CREATE POLICY "pms_documents_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'pms-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "pms_documents_select" ON storage.objects;
CREATE POLICY "pms_documents_select" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'pms-documents'
  AND EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.storage_path = name
      AND (
        d.uploaded_by = auth.uid()
        OR d.tenant_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = d.property_id AND p.owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      )
  )
);

DROP POLICY IF EXISTS "pms_documents_delete" ON storage.objects;
CREATE POLICY "pms_documents_delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'pms-documents'
  AND EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.storage_path = name
      AND (
        d.uploaded_by = auth.uid()
        OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = d.property_id AND p.owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      )
  )
);

CREATE OR REPLACE FUNCTION public.get_document_page(
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 20,
  p_query text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_page integer := GREATEST(COALESCE(p_page, 1), 1);
  v_size integer := GREATEST(1, LEAST(COALESCE(p_page_size, 20), 100));
  v_offset integer;
  v_total integer;
  v_rows jsonb;
BEGIN
  SELECT role::text INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF auth.uid() IS NULL OR v_role NOT IN ('admin','owner','agent','customer') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  v_offset := (v_page - 1) * v_size;

  SELECT count(*) INTO v_total
  FROM public.documents d
  WHERE (p_category IS NULL OR d.category = p_category)
    AND (p_status IS NULL OR d.status = p_status)
    AND (
      p_query IS NULL OR p_query = ''
      OR d.title ILIKE '%' || p_query || '%'
      OR d.file_name ILIKE '%' || p_query || '%'
      OR d.category ILIKE '%' || p_query || '%'
      OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = d.property_id AND p.name ILIKE '%' || p_query || '%')
      OR EXISTS (SELECT 1 FROM public.profiles t WHERE t.id = d.tenant_id AND COALESCE(t.full_name,'') ILIKE '%' || p_query || '%')
    )
    AND (
      v_role = 'admin'
      OR d.uploaded_by = auth.uid()
      OR d.tenant_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = d.property_id AND p.owner_id = auth.uid())
    );

  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT d.id, d.title, d.category, d.status, d.file_name, d.mime_type, d.file_size, d.storage_path,
           d.property_id, d.lease_id, d.uploaded_by, d.tenant_id, d.review_notes, d.created_at, d.updated_at,
           p.name AS property_name, tn.full_name AS tenant_name, up.full_name AS uploader_name
    FROM public.documents d
    LEFT JOIN public.properties p ON p.id = d.property_id
    LEFT JOIN public.profiles tn ON tn.id = d.tenant_id
    LEFT JOIN public.profiles up ON up.id = d.uploaded_by
    WHERE (p_category IS NULL OR d.category = p_category)
      AND (p_status IS NULL OR d.status = p_status)
      AND (
        p_query IS NULL OR p_query = '' OR d.title ILIKE '%' || p_query || '%' OR d.file_name ILIKE '%' || p_query || '%' OR d.category ILIKE '%' || p_query || '%'
        OR COALESCE(p.name,'') ILIKE '%' || p_query || '%' OR COALESCE(tn.full_name,'') ILIKE '%' || p_query || '%'
      )
      AND (v_role = 'admin' OR d.uploaded_by = auth.uid() OR d.tenant_id = auth.uid() OR EXISTS (SELECT 1 FROM public.properties op WHERE op.id = d.property_id AND op.owner_id = auth.uid()))
    ORDER BY d.created_at DESC, d.id DESC
    OFFSET v_offset LIMIT v_size
  ) x;

  RETURN jsonb_build_object('rows', v_rows, 'total', v_total, 'total_pages', GREATEST(1, CEIL(v_total::numeric / v_size)::integer));
END;
$$;

REVOKE ALL ON FUNCTION public.get_document_page(integer,integer,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_document_page(integer,integer,text,text,text) TO authenticated;
