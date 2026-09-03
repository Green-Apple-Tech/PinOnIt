-- Allow Quick Addendum as a host-editable document template type.

ALTER TABLE public.host_document_templates
  DROP CONSTRAINT IF EXISTS host_document_templates_type_check;

ALTER TABLE public.host_document_templates
  ADD CONSTRAINT host_document_templates_type_check CHECK (document_type IN (
    'nda', 'contract', 'waiver', 'quote', 'invoice', 'receipt', 'quick_addendum'
  ));

NOTIFY pgrst, 'reload schema';
