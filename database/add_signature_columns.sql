alter table public.certificate_verification 
  add column if not exists signature_data jsonb,
  add column if not exists timestamp_data jsonb,
  add column if not exists signed_at timestamptz;

create index if not exists idx_cert_verif_cert_id on public.certificate_verification(certificate_id);
create index if not exists idx_cert_verif_level on public.certificate_verification(verification_level);
