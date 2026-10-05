-- ============================================================================
-- Kontrak metode PYRANOMETER (rules bertipe) — idempoten.
-- ----------------------------------------------------------------------------
-- Mengisi `rules` profil pyranometer dengan kontrak lengkap: tiap komponen
-- uncertainty memuat cara hitung (distribusi, pembagi, derajat bebas, faktor)
-- + provenance (sumber nilai & klasifikasi). Nilai default = perilaku sistem
-- saat ini, dengan rujukan ke workbook/ISO/spesifikasi.
--
-- TERISOLASI: hanya menyentuh profil ber-scope 'pyranometer'. Tidak mengubah
-- tipping bucket (RR) maupun raw_general (AWOS/AWS).
--
-- Aman dijalankan berkali-kali (ON CONFLICT (code, version)).
-- ============================================================================

INSERT INTO public.calibration_method_profiles
  (code, name, instrument_scope, adapter_id, version, source_documents, rules, effective_from, is_active)
VALUES (
  'PYR-LEGACY-BMKG',
  'Pyranometer Legacy BMKG',
  'pyranometer',
  'pyranometer-v1',
  1,
  '[{"code":"ISO 9060","edition":"2018"},{"code":"ISO 9847","edition":"1992"},{"code":"WMO-No. 8","edition":"2018"}]'::jsonb,
  '{
    "schemaVersion": 1,
    "cfRule": "MEAN_ALL_VALID",
    "outlierThreshold": 2,
    "coverageFactorRule": "student_t_95",
    "components": [
      {"key":"repeat","label":"Repeatability","enabled":true,"distribution":"normal","divisor":"sqrt_n","vi":{"type":"n_minus_1"},"factor":1,
       "source":{"doc":"pyranometer.xlsx","ref":"Data glolbal!F169 / Hit U!G12","classification":"VARIABEL"}},
      {"key":"cert_std","label":"Sertifikat Standar","enabled":true,"distribution":"normal","divisor":2,"vi":{"type":"fixed","value":50},"factor":1,
       "source":{"doc":"Sertifikat standar","ref":"Hit U!G13 (U standar, k=2)","classification":"SPESIFIKASI"}},
      {"key":"res_std","label":"Resolusi Standar","enabled":true,"distribution":"rect","divisor":"sqrt3","vi":{"type":"fixed","value":50},"factor":1,"basis":"mean_std",
       "source":{"doc":"pyranometer.xlsx","ref":"Input Data!C45 / Hit U!G14","classification":"SPESIFIKASI"}},
      {"key":"drift_std","label":"Drift Standar","enabled":true,"distribution":"rect","divisor":"sqrt3","vi":{"type":"fixed","value":50},"factor":1,
       "source":{"doc":"ISO 9060:2018","ref":"Class A/B/C = 0.8/1.5/3.0%","classification":"KONSTANTA"}},
      {"key":"res_uut","label":"Resolusi UUT","enabled":true,"distribution":"rect","divisor":"sqrt3","vi":{"type":"fixed","value":50},"factor":100,"basis":"mean_uut",
       "source":{"doc":"pyranometer.xlsx","ref":"Input Data!C31 / Hit U!G16","classification":"SPESIFIKASI"}}
    ]
  }'::jsonb,
  '2026-01-01',
  true
)
ON CONFLICT (code, version) DO UPDATE SET
  rules = EXCLUDED.rules,
  source_documents = EXCLUDED.source_documents,
  adapter_id = EXCLUDED.adapter_id,
  is_active = true;

-- Verifikasi (opsional):
--   SELECT code, jsonb_array_length(rules->'components') AS komponen
--     FROM calibration_method_profiles WHERE instrument_scope = 'pyranometer';
