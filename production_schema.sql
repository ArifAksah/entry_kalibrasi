-- ============================================================
-- PRODUCTION SCHEMA EXPORT
-- ============================================================

-- 1. ENUM TYPES
CREATE TYPE public.data_source AS ENUM ('logger', 'standard');
CREATE TYPE public.jenis_alat AS ENUM ('digital', 'analog');
CREATE TYPE public.user_role AS ENUM ('admin', 'kalibrator', 'pusat', 'balai', 'stasiun', 'calibrator', 'verifikator', 'assignor', 'user_station');

-- 2. SEQUENCES
CREATE SEQUENCE IF NOT EXISTS public.audit_logs_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.calibration_measurement_measurement_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.calibration_result_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.cert_standard_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.certificate_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.certificate_logs_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.certificate_verification_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.inspection_person_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.inspection_results_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.instrument_cal_result_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.instrument_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.instrument_names_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.instrument_sensors_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.instrument_types_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.letter_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.logger_discovery_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.logger_rows_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.master_qc_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.notes_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.notes_instrumen_standard_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.notifications_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.password_reset_tokens_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.qc_uncertainty_components_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.raw_data_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.ref_unit_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.sensor_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.station_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.std_manual_readings_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.user_stations_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.verifikator_cal_result_id_seq;

-- 3. TABLES
CREATE TABLE IF NOT EXISTS public.audit_logs (  id bigint NOT NULL,
  user_id uuid NOT NULL,
  action text NOT NULL,
  status text NOT NULL,
  details jsonb,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.calibration_import (  import_id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  source data_source NOT NULL,
  file_name text,
  imported_at timestamp with time zone NOT NULL DEFAULT now(),
  notes jsonb
);

CREATE TABLE IF NOT EXISTS public.calibration_import_mapping (  mapping_id uuid NOT NULL DEFAULT gen_random_uuid(),
  sheet_id uuid NOT NULL,
  raw_column_name text NOT NULL,
  parameter_code text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  unit text,
  avg_window_sec integer,
  transform jsonb,
  priority integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.calibration_import_sheet (  sheet_id uuid NOT NULL DEFAULT gen_random_uuid(),
  import_id uuid NOT NULL,
  sheet_name text NOT NULL,
  ts_column text,
  sheet_kind text,
  notes jsonb
);

CREATE TABLE IF NOT EXISTS public.calibration_measurement (  measurement_id bigint NOT NULL DEFAULT nextval('calibration_measurement_measurement_id_seq'::regclass),
  session_id uuid NOT NULL,
  import_id uuid,
  sheet_id uuid,
  source data_source NOT NULL,
  ts timestamp with time zone NOT NULL,
  parameter_code text NOT NULL,
  value numeric,
  unit text,
  avg_window_sec integer,
  raw_column_name text,
  row_no integer,
  quality jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.calibration_reference (  session_id uuid NOT NULL,
  std_instrument_id bigint NOT NULL,
  parameter_scope jsonb
);

CREATE TABLE IF NOT EXISTS public.calibration_result (  id bigint NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  environment json,
  table_result json,
  sensor bigint,
  note bigint
);

CREATE TABLE IF NOT EXISTS public.calibration_session (  session_id uuid NOT NULL DEFAULT gen_random_uuid(),
  station_id integer,
  uut_instrument_id bigint NOT NULL,
  tgl_kalibrasi date NOT NULL,
  order_no text,
  ident text,
  no_sertifikat text,
  nomor_akreditasi text,
  status jsonb,
  keterangan jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  uut_sensor_id bigint,
  std_cert_id bigint,
  start_date timestamp with time zone,
  end_date timestamp with time zone,
  place text
);

CREATE TABLE IF NOT EXISTS public.certificate (  id bigint NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  no_certificate character varying NOT NULL,
  no_order character varying NOT NULL,
  no_identification character varying NOT NULL,
  authorized_by uuid,
  issue_date date NOT NULL,
  station bigint,
  instrument bigint,
  created_by uuid,
  verifikator_1 uuid,
  verifikator_2 uuid,
  results jsonb,
  version integer NOT NULL DEFAULT 1,
  verification_notes text,
  rejection_reason text,
  repair_notes text,
  repair_status character varying DEFAULT 'none'::character varying,
  repair_requested_at timestamp with time zone,
  repair_completed_at timestamp with time zone,
  station_address text,
  status character varying(20) DEFAULT 'draft'::character varying,
  draft_created_at timestamp with time zone DEFAULT now(),
  sent_to_verifiers_at timestamp with time zone,
  sent_by uuid,
  assignor uuid,
  rejection_count integer DEFAULT 0,
  last_rejection_by uuid,
  last_rejection_at timestamp with time zone,
  rejection_history jsonb DEFAULT '[]'::jsonb,
  pdf_path text,
  pdf_generated_at timestamp with time zone,
  public_id uuid NOT NULL DEFAULT gen_random_uuid(),
  verifikator_3 uuid,
  verifikator_3_status text DEFAULT 'pending'::text,
  certificate_type text DEFAULT 'sert'::text,
  calibration_place character varying(2) DEFAULT 'FC'::character varying,
  instrument_code text,
  calibration_computed_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.certificate_logs (  id integer NOT NULL DEFAULT nextval('certificate_logs_id_seq'::regclass),
  certificate_id integer NOT NULL,
  action character varying(50) NOT NULL,
  performed_by uuid NOT NULL,
  performed_by_name text,
  notes text,
  rejection_reason text,
  approval_notes text,
  verification_level integer,
  previous_status character varying(50),
  new_status character varying(50),
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.certificate_standard (  id bigint NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  no_certificate character varying,
  calibration_date date,
  drift double precision,
  range character varying,
  resolution double precision,
  u95_general double precision,
  sensor_id bigint,
  correction_std json,
  u95_std json,
  setpoint json,
  traceability character varying
);

CREATE TABLE IF NOT EXISTS public.certificate_verification (  id integer NOT NULL,
  certificate_id integer NOT NULL,
  verification_level integer NOT NULL,
  status character varying NOT NULL DEFAULT 'pending'::character varying,
  notes text,
  verified_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  certificate_version integer NOT NULL DEFAULT 1,
  rejection_reason text,
  approval_notes text,
  rejection_destination character varying(20) DEFAULT 'creator'::character varying,
  rejection_reason_detailed text,
  rejection_timestamp timestamp with time zone DEFAULT now(),
  signature_data jsonb,
  timestamp_data jsonb,
  signed_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.endpoint_catalog (  id uuid NOT NULL DEFAULT gen_random_uuid(),
  resource text NOT NULL,
  method text NOT NULL,
  path text NOT NULL,
  description text,
  enabled boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.inspection_person (  id bigint NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  result bigint,
  inspection_by uuid
);

CREATE TABLE IF NOT EXISTS public.inspection_results (  id bigint NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  inspection_date date,
  inspection_place character varying,
  notes text,
  table_inspection_result json
);

CREATE TABLE IF NOT EXISTS public.instrument (  id bigint NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  manufacturer character varying NOT NULL,
  type character varying,
  serial_number character varying,
  others text,
  station_id integer,
  instrument_type_id integer,
  instrument_names_id bigint,
  name text,
  memiliki_lebih_satu boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.instrument_cal_result (  id bigint NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  instrument bigint,
  sensor_cal_result bigint
);

CREATE TABLE IF NOT EXISTS public.instrument_names (  id bigint NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  name character varying NOT NULL,
  code_alat character varying
);

CREATE TABLE IF NOT EXISTS public.instrument_sensors (  id integer NOT NULL DEFAULT nextval('instrument_sensors_id_seq'::regclass),
  instrument_id integer NOT NULL,
  sensor_id integer NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.instrument_types (  id integer NOT NULL DEFAULT nextval('instrument_types_id_seq'::regclass),
  name character varying(100) NOT NULL,
  description text,
  created_at timestamp without time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.letter (  id bigint NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  no_letter character varying NOT NULL,
  instrument bigint,
  owner bigint,
  issue_date date NOT NULL,
  inspection_result bigint,
  authorized_by uuid
);

CREATE TABLE IF NOT EXISTS public.logger_channel_map (  id uuid NOT NULL DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  sensor_id bigint NOT NULL,
  logger_station_code text,
  value_index integer,
  unit text,
  role text,
  active boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.logger_discovery (  id bigint NOT NULL DEFAULT nextval('logger_discovery_id_seq'::regclass),
  run_id uuid NOT NULL,
  logger_station_code text,
  value_index integer,
  is_numeric_ratio numeric,
  sample_min numeric,
  sample_max numeric,
  sample_mean numeric,
  sample_stddev numeric
);

CREATE TABLE IF NOT EXISTS public.logger_rows (  id bigint NOT NULL DEFAULT nextval('logger_rows_id_seq'::regclass),
  run_id uuid NOT NULL,
  row_no integer NOT NULL,
  logger_station_code text,
  ts timestamp with time zone,
  "values" jsonb,
  raw_line text,
  parse_ok boolean DEFAULT false,
  parse_error text
);

CREATE TABLE IF NOT EXISTS public.master_qc (  id bigint NOT NULL DEFAULT nextval('master_qc_id_seq'::regclass),
  instrument_name_id bigint NOT NULL,
  unit_id bigint NOT NULL,
  nilai_batas_koreksi text NOT NULL,
  catatan text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notes (  id bigint NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  traceable_to_si_through character varying,
  reference_document character varying,
  calibration_methode character varying,
  others text
);

CREATE TABLE IF NOT EXISTS public.notes_instrumen_standard (  id bigint NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  notes bigint,
  instrumen_standard bigint
);

CREATE TABLE IF NOT EXISTS public.notifications (  id bigint NOT NULL DEFAULT nextval('notifications_id_seq'::regclass),
  user_id uuid NOT NULL,
  message text NOT NULL,
  link text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.password_reset_tokens (  id integer NOT NULL DEFAULT nextval('password_reset_tokens_id_seq'::regclass),
  email character varying(255) NOT NULL,
  token character varying(255) NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  used boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.personel (  id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  name character varying(255) NOT NULL,
  nip character varying(100),
  "position" character varying(255),
  phone character varying(50),
  email character varying(255),
  station_user bigint,
  nik text,
  nik_index text
);

CREATE TABLE IF NOT EXISTS public.qc_files (  id uuid NOT NULL DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  file_type text NOT NULL,
  bucket text NOT NULL,
  path text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.qc_points (  id uuid NOT NULL DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  param_code text,
  setpoint_nominal numeric,
  std_mean numeric,
  uut_mean numeric,
  correction_mean numeric,
  correction_stddev numeric,
  n_points integer,
  u95 numeric,
  unit text,
  meta jsonb
);

CREATE TABLE IF NOT EXISTS public.qc_runs (  id uuid NOT NULL DEFAULT gen_random_uuid(),
  certificate_id bigint,
  station_id bigint,
  instrument_id bigint,
  sensor_id bigint,
  status text DEFAULT 'uploaded'::text,
  qc_version text DEFAULT 'v1'::text,
  logger_file_path text,
  std_certificate_id uuid,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  error text
);

CREATE TABLE IF NOT EXISTS public.qc_uncertainty_components (  id bigint NOT NULL DEFAULT nextval('qc_uncertainty_components_id_seq'::regclass),
  run_id uuid NOT NULL,
  param_code text,
  setpoint_nominal numeric,
  component text,
  value numeric,
  note text
);

CREATE TABLE IF NOT EXISTS public.qc_windows (  id uuid NOT NULL DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  param_code text,
  setpoint_nominal numeric,
  start_ts timestamp with time zone,
  end_ts timestamp with time zone,
  direction text,
  notes text
);

CREATE TABLE IF NOT EXISTS public.raw_data (  id bigint NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  "timestamp" timestamp without time zone,
  standard_data double precision,
  uut_data double precision,
  sensor_id_uut bigint,
  session_id uuid,
  sensor_id_std bigint,
  std_correction numeric,
  std_corrected numeric,
  uut_correction numeric,
  sheet_name character varying,
  unit_std character varying,
  unit_uut character varying
);

CREATE TABLE IF NOT EXISTS public.ref_stations (  station_id character varying NOT NULL,
  station_wmo_id character varying,
  station_name character varying NOT NULL,
  current_latitude numeric,
  current_longitude numeric,
  current_elevation numeric,
  timezone character varying,
  region_description character varying,
  propinsi_name character varying,
  kabupaten_name character varying,
  wigos_id character varying,
  created_at timestamp with time zone DEFAULT now(),
  station_type_id integer
);

CREATE TABLE IF NOT EXISTS public.ref_unit (  id bigint NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  unit text
);

CREATE TABLE IF NOT EXISTS public.role_endpoint_permissions (  role user_role NOT NULL,
  endpoint_id uuid NOT NULL,
  allow boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.role_permissions (  role text NOT NULL,
  resource text NOT NULL,
  can_create boolean NOT NULL DEFAULT false,
  can_read boolean NOT NULL DEFAULT false,
  can_update boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.sensor (  id bigint NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  manufacturer character varying,
  type character varying,
  serial_number character varying,
  range_capacity character varying,
  range_capacity_unit character varying,
  graduating character varying,
  graduating_unit character varying,
  funnel_diameter double precision,
  funnel_diameter_unit character varying,
  volume_per_tip character varying,
  volume_per_tip_unit character varying,
  funnel_area double precision,
  funnel_area_unit character varying,
  name character varying,
  is_standard boolean NOT NULL DEFAULT false,
  instrument_id bigint,
  sensor_name_id bigint,
  resolution double precision,
  tracebility text
);

CREATE TABLE IF NOT EXISTS public.station (  id bigint NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  wmo_id character varying,
  name character varying NOT NULL,
  address character varying,
  latitude double precision,
  longitude double precision,
  elevation double precision,
  time_zone character varying,
  region character varying,
  province character varying,
  regency character varying,
  created_by uuid,
  type character varying,
  type_id integer,
  station_id character varying,
  station_wmo_id integer
);

CREATE TABLE IF NOT EXISTS public.station_type (  id integer NOT NULL,
  name character varying NOT NULL
);

CREATE TABLE IF NOT EXISTS public.std_certificates (  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  serial_no text,
  k_factor_default numeric DEFAULT 2,
  drift_value numeric,
  unit text,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.std_manual_readings (  id bigint NOT NULL DEFAULT nextval('std_manual_readings_id_seq'::regclass),
  run_id uuid NOT NULL,
  window_id uuid NOT NULL,
  std_reading numeric NOT NULL,
  unit text
);

CREATE TABLE IF NOT EXISTS public.user_roles (  user_id uuid NOT NULL,
  role user_role NOT NULL,
  station_id integer,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_settings (  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_stations (  id integer NOT NULL DEFAULT nextval('user_stations_id_seq'::regclass),
  user_id uuid NOT NULL,
  station_id integer NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.verifikator_cal_result (  id bigint NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  cal_result bigint,
  verified_by uuid
);

-- 4. PRIMARY KEYS
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.calibration_import ADD CONSTRAINT calibration_import_pkey PRIMARY KEY (import_id);
ALTER TABLE public.calibration_import_mapping ADD CONSTRAINT calibration_import_mapping_pkey PRIMARY KEY (mapping_id);
ALTER TABLE public.calibration_import_sheet ADD CONSTRAINT calibration_import_sheet_pkey PRIMARY KEY (sheet_id);
ALTER TABLE public.calibration_measurement ADD CONSTRAINT calibration_measurement_pkey PRIMARY KEY (measurement_id);
ALTER TABLE public.calibration_reference ADD CONSTRAINT calibration_reference_pkey PRIMARY KEY (session_id, std_instrument_id);
ALTER TABLE public.calibration_result ADD CONSTRAINT calibration_result_pkey PRIMARY KEY (id);
ALTER TABLE public.calibration_session ADD CONSTRAINT calibration_session_pkey PRIMARY KEY (session_id);
ALTER TABLE public.certificate ADD CONSTRAINT certificate_pkey PRIMARY KEY (id);
ALTER TABLE public.certificate_logs ADD CONSTRAINT certificate_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.certificate_standard ADD CONSTRAINT cert_standard_pkey PRIMARY KEY (id);
ALTER TABLE public.certificate_verification ADD CONSTRAINT certificate_verification_pkey PRIMARY KEY (id);
ALTER TABLE public.endpoint_catalog ADD CONSTRAINT endpoint_catalog_pkey PRIMARY KEY (id);
ALTER TABLE public.inspection_person ADD CONSTRAINT inspection_person_pkey PRIMARY KEY (id);
ALTER TABLE public.inspection_results ADD CONSTRAINT inspection_results_pkey PRIMARY KEY (id);
ALTER TABLE public.instrument ADD CONSTRAINT instrument_pkey PRIMARY KEY (id);
ALTER TABLE public.instrument_cal_result ADD CONSTRAINT instrument_cal_result_pkey PRIMARY KEY (id);
ALTER TABLE public.instrument_names ADD CONSTRAINT instrument_names_pkey PRIMARY KEY (id);
ALTER TABLE public.instrument_sensors ADD CONSTRAINT instrument_sensors_pkey PRIMARY KEY (id);
ALTER TABLE public.instrument_types ADD CONSTRAINT instrument_types_pkey PRIMARY KEY (id);
ALTER TABLE public.letter ADD CONSTRAINT letter_pkey PRIMARY KEY (id);
ALTER TABLE public.logger_channel_map ADD CONSTRAINT logger_channel_map_pkey PRIMARY KEY (id);
ALTER TABLE public.logger_discovery ADD CONSTRAINT logger_discovery_pkey PRIMARY KEY (id);
ALTER TABLE public.logger_rows ADD CONSTRAINT logger_rows_pkey PRIMARY KEY (id);
ALTER TABLE public.master_qc ADD CONSTRAINT master_qc_pkey PRIMARY KEY (id);
ALTER TABLE public.notes ADD CONSTRAINT notes_pkey PRIMARY KEY (id);
ALTER TABLE public.notes_instrumen_standard ADD CONSTRAINT notes_instrumen_standard_pkey PRIMARY KEY (id);
ALTER TABLE public.notifications ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);
ALTER TABLE public.password_reset_tokens ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);
ALTER TABLE public.personel ADD CONSTRAINT personel_pkey PRIMARY KEY (id);
ALTER TABLE public.qc_files ADD CONSTRAINT qc_files_pkey PRIMARY KEY (id);
ALTER TABLE public.qc_points ADD CONSTRAINT qc_points_pkey PRIMARY KEY (id);
ALTER TABLE public.qc_runs ADD CONSTRAINT qc_runs_pkey PRIMARY KEY (id);
ALTER TABLE public.qc_uncertainty_components ADD CONSTRAINT qc_uncertainty_components_pkey PRIMARY KEY (id);
ALTER TABLE public.qc_windows ADD CONSTRAINT qc_windows_pkey PRIMARY KEY (id);
ALTER TABLE public.raw_data ADD CONSTRAINT raw_data_pkey PRIMARY KEY (id);
ALTER TABLE public.ref_stations ADD CONSTRAINT ref_stations_pkey PRIMARY KEY (station_id);
ALTER TABLE public.ref_unit ADD CONSTRAINT ref_unit_pkey PRIMARY KEY (id);
ALTER TABLE public.role_endpoint_permissions ADD CONSTRAINT role_endpoint_permissions_pkey PRIMARY KEY (endpoint_id, role);
ALTER TABLE public.role_permissions ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (resource, role);
ALTER TABLE public.sensor ADD CONSTRAINT sensor_pkey PRIMARY KEY (id);
ALTER TABLE public.station ADD CONSTRAINT station_pkey PRIMARY KEY (id);
ALTER TABLE public.station_type ADD CONSTRAINT station_type_pkey PRIMARY KEY (id);
ALTER TABLE public.std_certificates ADD CONSTRAINT std_certificates_pkey PRIMARY KEY (id);
ALTER TABLE public.std_manual_readings ADD CONSTRAINT std_manual_readings_pkey PRIMARY KEY (id);
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id);
ALTER TABLE public.user_settings ADD CONSTRAINT user_settings_pkey PRIMARY KEY (id);
ALTER TABLE public.user_stations ADD CONSTRAINT user_stations_pkey PRIMARY KEY (id);
ALTER TABLE public.verifikator_cal_result ADD CONSTRAINT verifikator_cal_result_pkey PRIMARY KEY (id);

-- 5. UNIQUE CONSTRAINTS
ALTER TABLE public.certificate ADD CONSTRAINT certificate_no_certificate_unique UNIQUE (no_certificate);
ALTER TABLE public.certificate ADD CONSTRAINT certificate_public_id_key UNIQUE (public_id);
ALTER TABLE public.certificate_verification ADD CONSTRAINT certificate_verification_unique UNIQUE (certificate_id, verification_level, certificate_version);
ALTER TABLE public.instrument_names ADD CONSTRAINT instrument_names_name_key UNIQUE (name);
ALTER TABLE public.instrument_sensors ADD CONSTRAINT instrument_sensors_instrument_id_sensor_id_key UNIQUE (instrument_id, sensor_id);
ALTER TABLE public.instrument_types ADD CONSTRAINT instrument_types_name_key UNIQUE (name);
ALTER TABLE public.password_reset_tokens ADD CONSTRAINT password_reset_tokens_token_key UNIQUE (token);
ALTER TABLE public.personel ADD CONSTRAINT personel_email_key UNIQUE (email);
ALTER TABLE public.user_settings ADD CONSTRAINT user_settings_user_id_key UNIQUE (user_id);
ALTER TABLE public.user_stations ADD CONSTRAINT user_stations_user_id_station_id_key UNIQUE (user_id, station_id);

-- 6. INDEXES
CREATE INDEX idx_audit_created_at ON public.audit_logs USING btree (created_at);
CREATE INDEX idx_audit_user ON public.audit_logs USING btree (user_id);
CREATE INDEX idx_audit_action ON public.audit_logs USING btree (action);
CREATE INDEX idx_cal_import_session ON public.calibration_import USING btree (session_id);
CREATE INDEX idx_mapping_param ON public.calibration_import_mapping USING btree (parameter_code);
CREATE INDEX idx_mapping_sheet ON public.calibration_import_mapping USING btree (sheet_id);
CREATE INDEX gin_mapping_transform ON public.calibration_import_mapping USING gin (transform);
CREATE INDEX idx_meas_sheet ON public.calibration_measurement USING btree (sheet_id);
CREATE INDEX idx_meas_import ON public.calibration_measurement USING btree (import_id);
CREATE INDEX gin_meas_quality ON public.calibration_measurement USING gin (quality);
CREATE INDEX idx_meas_lookup ON public.calibration_measurement USING btree (session_id, source, parameter_code, ts);
CREATE INDEX idx_cal_ref_std ON public.calibration_reference USING btree (std_instrument_id);
CREATE INDEX idx_cal_session_tgl ON public.calibration_session USING btree (tgl_kalibrasi);
CREATE INDEX idx_cal_session_uut ON public.calibration_session USING btree (uut_instrument_id);
CREATE INDEX idx_certificate_last_rejection_by ON public.certificate USING btree (last_rejection_by);
CREATE INDEX idx_certificate_pdf_path ON public.certificate USING btree (pdf_path);
CREATE INDEX idx_certificate_draft_created_at ON public.certificate USING btree (draft_created_at);
CREATE INDEX idx_certificate_sent_to_verifiers_at ON public.certificate USING btree (sent_to_verifiers_at);
CREATE INDEX idx_certificate_sent_by ON public.certificate USING btree (sent_by);
CREATE INDEX idx_certificate_assignor ON public.certificate USING btree (assignor);
CREATE INDEX idx_certificate_rejection_count ON public.certificate USING btree (rejection_count);
CREATE INDEX idx_certificate_public_id ON public.certificate USING btree (public_id);
CREATE INDEX idx_certificate_created_at ON public.certificate USING btree (created_at);
CREATE INDEX idx_certificate_place_created ON public.certificate USING btree (calibration_place, created_at);
CREATE INDEX idx_certificate_status ON public.certificate USING btree (status);
CREATE INDEX idx_certificate_logs_certificate_id ON public.certificate_logs USING btree (certificate_id);
CREATE INDEX idx_certificate_logs_performed_by ON public.certificate_logs USING btree (performed_by);
CREATE INDEX idx_certificate_logs_certificate_action ON public.certificate_logs USING btree (certificate_id, action);
CREATE INDEX idx_certificate_logs_created_at ON public.certificate_logs USING btree (created_at DESC);
CREATE INDEX idx_certificate_logs_action ON public.certificate_logs USING btree (action);
CREATE INDEX idx_certificate_verification_certificate_version ON public.certificate_verification USING btree (certificate_version);
CREATE INDEX idx_certificate_verification_certificate_id ON public.certificate_verification USING btree (certificate_id);
CREATE INDEX idx_certificate_verification_verified_by ON public.certificate_verification USING btree (verified_by);
CREATE INDEX idx_certificate_verification_status ON public.certificate_verification USING btree (status);
CREATE INDEX idx_certificate_verification_level ON public.certificate_verification USING btree (verification_level);
CREATE INDEX idx_certificate_verification_rejection_destination ON public.certificate_verification USING btree (rejection_destination);
CREATE INDEX idx_certificate_verification_rejection_timestamp ON public.certificate_verification USING btree (rejection_timestamp);
CREATE INDEX idx_cert_verif_cert_id ON public.certificate_verification USING btree (certificate_id);
CREATE INDEX idx_cert_verif_level ON public.certificate_verification USING btree (verification_level);
CREATE INDEX idx_instrument_station_id ON public.instrument USING btree (station_id);
CREATE INDEX idx_instrument_names_code_alat ON public.instrument_names USING btree (code_alat) WHERE (code_alat IS NOT NULL);
CREATE INDEX idx_instrument_sensors_instrument_id ON public.instrument_sensors USING btree (instrument_id);
CREATE INDEX idx_instrument_sensors_sensor_id ON public.instrument_sensors USING btree (sensor_id);
CREATE INDEX idx_logger_rows_run_station_ts ON public.logger_rows USING btree (run_id, logger_station_code, ts);
CREATE INDEX idx_master_qc_unit ON public.master_qc USING btree (unit_id);
CREATE INDEX idx_master_qc_instrument ON public.master_qc USING btree (instrument_name_id);
CREATE INDEX idx_password_reset_tokens_expires ON public.password_reset_tokens USING btree (expires_at);
CREATE INDEX idx_password_reset_tokens_token ON public.password_reset_tokens USING btree (token);
CREATE INDEX idx_password_reset_tokens_email ON public.password_reset_tokens USING btree (email);
CREATE INDEX idx_personel_nik_index ON public.personel USING btree (nik_index);
CREATE INDEX idx_user_settings_user_id ON public.user_settings USING btree (user_id);
CREATE INDEX idx_user_stations_user_id ON public.user_stations USING btree (user_id);
CREATE INDEX idx_user_stations_station_id ON public.user_stations USING btree (station_id);

-- 7. FOREIGN KEYS
-- Note: Requires users table to exist. Assuming it is managed by supabase auth.
-- Removing references to auth.users if not present, but keeping it as is assuming users table is in public or auth.
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
ALTER TABLE public.calibration_import ADD CONSTRAINT calibration_import_session_id_fkey FOREIGN KEY (session_id) REFERENCES calibration_session(session_id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE public.calibration_import_mapping ADD CONSTRAINT calibration_import_mapping_sheet_id_fkey FOREIGN KEY (sheet_id) REFERENCES calibration_import_sheet(sheet_id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE public.calibration_import_sheet ADD CONSTRAINT calibration_import_sheet_import_id_fkey FOREIGN KEY (import_id) REFERENCES calibration_import(import_id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE public.calibration_measurement ADD CONSTRAINT calibration_measurement_sheet_id_fkey FOREIGN KEY (sheet_id) REFERENCES calibration_import_sheet(sheet_id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE public.calibration_measurement ADD CONSTRAINT calibration_measurement_session_id_fkey FOREIGN KEY (session_id) REFERENCES calibration_session(session_id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE public.calibration_measurement ADD CONSTRAINT calibration_measurement_import_id_fkey FOREIGN KEY (import_id) REFERENCES calibration_import(import_id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE public.calibration_reference ADD CONSTRAINT calibration_reference_session_id_fkey FOREIGN KEY (session_id) REFERENCES calibration_session(session_id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE public.calibration_reference ADD CONSTRAINT calibration_reference_std_instrument_id_fkey FOREIGN KEY (std_instrument_id) REFERENCES instrument(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE public.calibration_result ADD CONSTRAINT calibration_result_sensor_fkey FOREIGN KEY (sensor) REFERENCES sensor(id);
ALTER TABLE public.calibration_result ADD CONSTRAINT calibration_result_note_fkey FOREIGN KEY (note) REFERENCES notes(id);
ALTER TABLE public.calibration_session ADD CONSTRAINT calibration_session_uut_instrument_id_fkey FOREIGN KEY (uut_instrument_id) REFERENCES instrument(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE public.calibration_session ADD CONSTRAINT fk_calibration_session_std_cert FOREIGN KEY (std_cert_id) REFERENCES certificate_standard(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE public.calibration_session ADD CONSTRAINT fk_calibration_session_uut_sensor FOREIGN KEY (uut_sensor_id) REFERENCES sensor(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE public.certificate ADD CONSTRAINT certificate_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE public.certificate ADD CONSTRAINT certificate_last_rejection_by_fkey FOREIGN KEY (last_rejection_by) REFERENCES personel(id);
ALTER TABLE public.certificate ADD CONSTRAINT certificate_verifikator_3_fkey FOREIGN KEY (verifikator_3) REFERENCES auth.users(id);
ALTER TABLE public.certificate ADD CONSTRAINT certificate_station_fkey FOREIGN KEY (station) REFERENCES station(id);
ALTER TABLE public.certificate ADD CONSTRAINT certificate_instrument_fkey FOREIGN KEY (instrument) REFERENCES instrument(id);
ALTER TABLE public.certificate ADD CONSTRAINT certificate_authorized_by_fkey FOREIGN KEY (authorized_by) REFERENCES personel(id);
ALTER TABLE public.certificate ADD CONSTRAINT certificate_verifikator_1_fkey FOREIGN KEY (verifikator_1) REFERENCES personel(id);
ALTER TABLE public.certificate ADD CONSTRAINT certificate_verifikator_2_fkey FOREIGN KEY (verifikator_2) REFERENCES personel(id);
ALTER TABLE public.certificate ADD CONSTRAINT certificate_assignor_fkey FOREIGN KEY (assignor) REFERENCES personel(id);
ALTER TABLE public.certificate ADD CONSTRAINT certificate_sent_by_fkey FOREIGN KEY (sent_by) REFERENCES personel(id);
ALTER TABLE public.certificate_logs ADD CONSTRAINT certificate_logs_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.certificate_logs ADD CONSTRAINT certificate_logs_certificate_id_fkey FOREIGN KEY (certificate_id) REFERENCES certificate(id) ON DELETE CASCADE;
ALTER TABLE public.certificate_standard ADD CONSTRAINT cert_standard_sensor_id_fkey FOREIGN KEY (sensor_id) REFERENCES sensor(id);
ALTER TABLE public.certificate_verification ADD CONSTRAINT certificate_verification_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES personel(id);
ALTER TABLE public.certificate_verification ADD CONSTRAINT certificate_verification_certificate_id_fkey FOREIGN KEY (certificate_id) REFERENCES certificate(id) ON DELETE CASCADE;
ALTER TABLE public.inspection_person ADD CONSTRAINT inspection_person_inspection_by_fkey FOREIGN KEY (inspection_by) REFERENCES personel(id);
ALTER TABLE public.inspection_person ADD CONSTRAINT inspection_by_result_fkey FOREIGN KEY (result) REFERENCES inspection_results(id);
ALTER TABLE public.instrument ADD CONSTRAINT instrument_station_id_fkey FOREIGN KEY (station_id) REFERENCES station(id);
ALTER TABLE public.instrument ADD CONSTRAINT instrument_instrument_type_id_fkey FOREIGN KEY (instrument_type_id) REFERENCES instrument_types(id);
ALTER TABLE public.instrument ADD CONSTRAINT instrument_instrument_names_id_fkey FOREIGN KEY (instrument_names_id) REFERENCES instrument_names(id);
ALTER TABLE public.instrument_cal_result ADD CONSTRAINT instrument_sensor_instrument_fkey FOREIGN KEY (instrument) REFERENCES instrument(id);
ALTER TABLE public.instrument_sensors ADD CONSTRAINT instrument_sensors_instrument_id_fkey FOREIGN KEY (instrument_id) REFERENCES instrument(id) ON DELETE CASCADE;
ALTER TABLE public.instrument_sensors ADD CONSTRAINT instrument_sensors_sensor_id_fkey FOREIGN KEY (sensor_id) REFERENCES sensor(id) ON DELETE CASCADE;
ALTER TABLE public.letter ADD CONSTRAINT letter_inspection_result_fkey FOREIGN KEY (inspection_result) REFERENCES inspection_results(id);
ALTER TABLE public.letter ADD CONSTRAINT letter_owner_fkey FOREIGN KEY (owner) REFERENCES station(id);
ALTER TABLE public.letter ADD CONSTRAINT letter_instrument_fkey FOREIGN KEY (instrument) REFERENCES instrument(id);
ALTER TABLE public.letter ADD CONSTRAINT letter_authorized_by_fkey FOREIGN KEY (authorized_by) REFERENCES personel(id);
ALTER TABLE public.logger_channel_map ADD CONSTRAINT fk_logger_channel_map_run FOREIGN KEY (run_id) REFERENCES qc_runs(id) ON DELETE CASCADE;
ALTER TABLE public.logger_channel_map ADD CONSTRAINT fk_logger_channel_map_sensor FOREIGN KEY (sensor_id) REFERENCES sensor(id) ON DELETE CASCADE;
ALTER TABLE public.logger_discovery ADD CONSTRAINT fk_logger_discovery_run FOREIGN KEY (run_id) REFERENCES qc_runs(id) ON DELETE CASCADE;
ALTER TABLE public.logger_rows ADD CONSTRAINT fk_logger_row_run FOREIGN KEY (run_id) REFERENCES qc_runs(id) ON DELETE CASCADE;
ALTER TABLE public.master_qc ADD CONSTRAINT master_qc_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES ref_unit(id) ON DELETE RESTRICT;
ALTER TABLE public.master_qc ADD CONSTRAINT master_qc_instrument_name_id_fkey FOREIGN KEY (instrument_name_id) REFERENCES instrument_names(id) ON DELETE CASCADE;
ALTER TABLE public.notes_instrumen_standard ADD CONSTRAINT notes_instrumen_standard_notes_fkey FOREIGN KEY (notes) REFERENCES notes(id);
ALTER TABLE public.notes_instrumen_standard ADD CONSTRAINT notes_instrumen_standard_instrumen_standard_fkey FOREIGN KEY (instrumen_standard) REFERENCES sensor(id);
ALTER TABLE public.notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.personel ADD CONSTRAINT personel_station_user_fkey FOREIGN KEY (station_user) REFERENCES station(id);
ALTER TABLE public.qc_files ADD CONSTRAINT fk_qc_file_run FOREIGN KEY (run_id) REFERENCES qc_runs(id) ON DELETE CASCADE;
ALTER TABLE public.qc_points ADD CONSTRAINT fk_qc_point_run FOREIGN KEY (run_id) REFERENCES qc_runs(id) ON DELETE CASCADE;
ALTER TABLE public.qc_runs ADD CONSTRAINT fk_qc_run_certificate FOREIGN KEY (certificate_id) REFERENCES certificate(id) ON DELETE CASCADE;
ALTER TABLE public.qc_runs ADD CONSTRAINT fk_qc_run_std_cert FOREIGN KEY (std_certificate_id) REFERENCES std_certificates(id) ON DELETE SET NULL;
ALTER TABLE public.qc_runs ADD CONSTRAINT fk_qc_run_instrument FOREIGN KEY (instrument_id) REFERENCES instrument(id) ON DELETE SET NULL;
ALTER TABLE public.qc_runs ADD CONSTRAINT fk_qc_run_sensor FOREIGN KEY (sensor_id) REFERENCES sensor(id) ON DELETE SET NULL;
ALTER TABLE public.qc_runs ADD CONSTRAINT fk_qc_run_station FOREIGN KEY (station_id) REFERENCES station(id) ON DELETE SET NULL;
ALTER TABLE public.qc_uncertainty_components ADD CONSTRAINT fk_qc_unc_run FOREIGN KEY (run_id) REFERENCES qc_runs(id) ON DELETE CASCADE;
ALTER TABLE public.qc_windows ADD CONSTRAINT fk_qc_window_run FOREIGN KEY (run_id) REFERENCES qc_runs(id) ON DELETE CASCADE;
ALTER TABLE public.raw_data ADD CONSTRAINT fk_raw_data_session FOREIGN KEY (session_id) REFERENCES calibration_session(session_id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE public.raw_data ADD CONSTRAINT raw_data_sensor_id_fkey FOREIGN KEY (sensor_id_uut) REFERENCES sensor(id);
ALTER TABLE public.raw_data ADD CONSTRAINT raw_data_sensor_id_std_fkey FOREIGN KEY (sensor_id_std) REFERENCES sensor(id) ON DELETE SET NULL;
ALTER TABLE public.role_endpoint_permissions ADD CONSTRAINT role_endpoint_permissions_endpoint_id_fkey FOREIGN KEY (endpoint_id) REFERENCES endpoint_catalog(id);
ALTER TABLE public.sensor ADD CONSTRAINT sensor_instrument_id_fkey FOREIGN KEY (instrument_id) REFERENCES instrument(id);
ALTER TABLE public.sensor ADD CONSTRAINT sensor_sensor_name_id_fkey FOREIGN KEY (sensor_name_id) REFERENCES instrument_names(id);
ALTER TABLE public.station ADD CONSTRAINT station_type_id_fkey FOREIGN KEY (type_id) REFERENCES station_type(id);
ALTER TABLE public.station ADD CONSTRAINT station_created_by_fkey FOREIGN KEY (created_by) REFERENCES personel(id);
ALTER TABLE public.std_manual_readings ADD CONSTRAINT fk_std_manual_run FOREIGN KEY (run_id) REFERENCES qc_runs(id) ON DELETE CASCADE;
ALTER TABLE public.std_manual_readings ADD CONSTRAINT fk_std_manual_window FOREIGN KEY (window_id) REFERENCES qc_windows(id) ON DELETE CASCADE;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
ALTER TABLE public.user_settings ADD CONSTRAINT user_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_stations ADD CONSTRAINT user_stations_station_id_fkey FOREIGN KEY (station_id) REFERENCES station(id) ON DELETE CASCADE;
ALTER TABLE public.user_stations ADD CONSTRAINT user_stations_user_id_fkey FOREIGN KEY (user_id) REFERENCES personel(id) ON DELETE CASCADE;
ALTER TABLE public.verifikator_cal_result ADD CONSTRAINT verifikator_cal_result_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES personel(id);

-- 8. CHECK CONSTRAINTS
ALTER TABLE public.certificate ADD CONSTRAINT certificate_place_check CHECK (((calibration_place)::text = ANY ((ARRAY['FC'::character varying, 'LC'::character varying])::text[])));
ALTER TABLE public.certificate ADD CONSTRAINT certificate_repair_status_check CHECK (((repair_status)::text = ANY (ARRAY[('none'::character varying)::text, ('pending'::character varying)::text, ('completed'::character varying)::text, ('rejected'::character varying)::text])));
ALTER TABLE public.certificate ADD CONSTRAINT certificate_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'sent'::character varying, 'verified'::character varying, 'rejected'::character varying, 'completed'::character varying])::text[])));
ALTER TABLE public.certificate ADD CONSTRAINT certificate_type_check CHECK ((certificate_type = ANY (ARRAY['sert'::text, 's_ket'::text])));
ALTER TABLE public.certificate_verification ADD CONSTRAINT certificate_verification_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[])));
ALTER TABLE public.certificate_verification ADD CONSTRAINT certificate_verification_verification_level_check CHECK ((verification_level = ANY (ARRAY[1, 2, 3, 4])));
ALTER TABLE public.certificate_verification ADD CONSTRAINT certificate_verification_rejection_destination_check CHECK (((rejection_destination)::text = ANY ((ARRAY['creator'::character varying, 'verifikator_1'::character varying])::text[])));

-- 9. VIEWS
CREATE OR REPLACE VIEW public.certificate_rejection_flow AS  SELECT c.id AS certificate_id, c.no_certificate, c.no_order, c.status, c.rejection_count, c.last_rejection_by, c.last_rejection_at, c.rejection_history, cv1.id AS verifikator_1_verification_id, cv1.status AS verifikator_1_status, cv1.rejection_destination AS verifikator_1_rejection_destination, cv1.rejection_reason_detailed AS verifikator_1_rejection_reason, cv1.rejection_timestamp AS verifikator_1_rejection_timestamp, cv2.id AS verifikator_2_verification_id, cv2.status AS verifikator_2_status, cv2.rejection_destination AS verifikator_2_rejection_destination, cv2.rejection_reason_detailed AS verifikator_2_rejection_reason, cv2.rejection_timestamp AS verifikator_2_rejection_timestamp, c.sent_by AS creator_id, p_creator.name AS creator_name, c.verifikator_1, p_v1.name AS verifikator_1_name, c.verifikator_2, p_v2.name AS verifikator_2_name FROM (((((certificate c LEFT JOIN certificate_verification cv1 ON (((c.id = cv1.certificate_id) AND (cv1.verification_level = 1)))) LEFT JOIN certificate_verification cv2 ON (((c.id = cv2.certificate_id) AND (cv2.verification_level = 2)))) LEFT JOIN personel p_creator ON ((c.sent_by = p_creator.id))) LEFT JOIN personel p_v1 ON ((c.verifikator_1 = p_v1.id))) LEFT JOIN personel p_v2 ON ((c.verifikator_2 = p_v2.id)));
CREATE OR REPLACE VIEW public.certificate_workflow_status AS  SELECT c.id AS certificate_id, c.no_certificate, c.no_order, c.status, c.draft_created_at, c.sent_to_verifiers_at, c.sent_by, c.assignor, c.verifikator_1, c.verifikator_2, c.authorized_by, CASE WHEN ((cv1.status)::text = 'approved'::text) THEN 'approved'::text WHEN ((cv1.status)::text = 'rejected'::text) THEN 'rejected'::text ELSE 'pending'::text END AS verifikator_1_status, CASE WHEN ((cv2.status)::text = 'approved'::text) THEN 'approved'::text WHEN ((cv2.status)::text = 'rejected'::text) THEN 'rejected'::text ELSE 'pending'::text END AS verifikator_2_status, CASE WHEN (((cv1.status)::text = 'rejected'::text) OR ((cv2.status)::text = 'rejected'::text)) THEN 'rejected'::text WHEN (((cv1.status)::text = 'approved'::text) AND ((cv2.status)::text = 'approved'::text)) THEN 'approved'::text ELSE 'pending'::text END AS overall_verification_status FROM ((certificate c LEFT JOIN certificate_verification cv1 ON (((c.id = cv1.certificate_id) AND (cv1.verification_level = 1)))) LEFT JOIN certificate_verification cv2 ON (((c.id = cv2.certificate_id) AND (cv2.verification_level = 2))));

-- 10. RLS POLICIES
ALTER TABLE public.certificate ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificate_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificate_standard ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instrument_sensors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_qc ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view assigned certificates" ON public.certificate AS PERMISSIVE FOR SELECT TO public USING (((((status)::text = 'draft'::text) AND (sent_by = auth.uid())) OR (verifikator_1 = auth.uid()) OR (verifikator_2 = auth.uid()) OR (assignor = auth.uid()) OR (authorized_by = auth.uid()) OR (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = 'admin'::user_role))))));
CREATE POLICY "Users can update assigned certificates" ON public.certificate AS PERMISSIVE FOR UPDATE TO public USING (((((status)::text = 'draft'::text) AND (sent_by = auth.uid())) OR (verifikator_1 = auth.uid()) OR (verifikator_2 = auth.uid()) OR (assignor = auth.uid()) OR (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = 'admin'::user_role))))));
CREATE POLICY "Users can create certificate drafts" ON public.certificate AS PERMISSIVE FOR INSERT TO public WITH CHECK ((((status)::text = 'draft'::text) AND (sent_by = auth.uid())));
CREATE POLICY user_station_select_certificate_logs ON public.certificate_logs AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM (user_roles ur JOIN certificate c ON ((c.station = ( SELECT user_roles.station_id FROM user_roles WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'user_station'::user_role)) LIMIT 1)))) WHERE ((ur.user_id = auth.uid()) AND (ur.role = 'user_station'::user_role) AND (c.id = certificate_logs.certificate_id)))));
CREATE POLICY admin_all_certificate_logs ON public.certificate_logs AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::user_role)))));
CREATE POLICY assignor_all_certificate_logs ON public.certificate_logs AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'assignor'::user_role)))));
CREATE POLICY calibrator_all_certificate_logs ON public.certificate_logs AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'calibrator'::user_role)))));
CREATE POLICY verifikator_select_certificate_logs ON public.certificate_logs AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'verifikator'::user_role)))));
CREATE POLICY verifikator_insert_certificate_logs ON public.certificate_logs AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'verifikator'::user_role)))) AND (EXISTS ( SELECT 1 FROM certificate c WHERE ((c.id = certificate_logs.certificate_id) AND ((c.verifikator_1 = auth.uid()) OR (c.verifikator_2 = auth.uid()) OR (c.authorized_by = auth.uid())))))));
CREATE POLICY "Users can view assigned certificate verifications" ON public.certificate_verification AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1 FROM certificate c WHERE ((c.id = certificate_verification.certificate_id) AND ((c.verifikator_1 = auth.uid()) OR (c.verifikator_2 = auth.uid()) OR (c.verifikator_3 = auth.uid()) OR (c.authorized_by = auth.uid()))))));
CREATE POLICY "Users can create assigned certificate verifications" ON public.certificate_verification AS PERMISSIVE FOR INSERT TO public WITH CHECK (((verified_by = auth.uid()) AND (EXISTS ( SELECT 1 FROM certificate c WHERE ((c.id = certificate_verification.certificate_id) AND (((c.verifikator_1 = auth.uid()) AND (certificate_verification.verification_level = 1)) OR ((c.verifikator_2 = auth.uid()) AND (certificate_verification.verification_level = 2)) OR ((c.verifikator_3 = auth.uid()) AND (certificate_verification.verification_level = 3)) OR ((c.authorized_by = auth.uid()) AND (certificate_verification.verification_level = 4))))))));
CREATE POLICY "Users can update assigned certificate verifications" ON public.certificate_verification AS PERMISSIVE FOR UPDATE TO public USING (((verified_by = auth.uid()) OR (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = 'admin'::user_role))))));
CREATE POLICY "Users can create certificate verifications" ON public.certificate_verification AS PERMISSIVE FOR INSERT TO public WITH CHECK (((verified_by = auth.uid()) OR (EXISTS ( SELECT 1 FROM user_roles ur WHERE ((ur.user_id = auth.uid()) AND (ur.role = 'admin'::user_role))))));
CREATE POLICY admin_all_instrument_sensors ON public.instrument_sensors AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::user_role)))));
CREATE POLICY assignor_all_instrument_sensors ON public.instrument_sensors AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'assignor'::user_role)))));
CREATE POLICY calibrator_all_instrument_sensors ON public.instrument_sensors AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'calibrator'::user_role)))));
CREATE POLICY verifikator_select_instrument_sensors ON public.instrument_sensors AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'verifikator'::user_role)))));
CREATE POLICY master_qc_select ON public.master_qc AS PERMISSIVE FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
CREATE POLICY master_qc_update ON public.master_qc AS PERMISSIVE FOR UPDATE TO public USING ((auth.role() = 'authenticated'::text));
CREATE POLICY master_qc_insert ON public.master_qc AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.role() = 'authenticated'::text));
CREATE POLICY master_qc_delete ON public.master_qc AS PERMISSIVE FOR DELETE TO public USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "Users can manage their own notifications" ON public.notifications AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users can insert their own settings" ON public.user_settings AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can delete their own settings" ON public.user_settings AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users can view their own settings" ON public.user_settings AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users can update their own settings" ON public.user_settings AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id));
CREATE POLICY user_select ON public.user_stations AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::user_role))))));
CREATE POLICY admin_all ON public.user_stations AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::user_role)))));
