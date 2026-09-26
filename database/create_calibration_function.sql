-- ============================================================================
-- Kalibrasi correction helpers (mengikuti workbook AWOS)
-- ============================================================================
-- Berisi:
--   1. normalisasi + konversi satuan (mengikuti konstanta workbook / lib/unitConversion.ts)
--   2. interpolasi koreksi standar (hitung_koreksi)
--   3. trigger yang unit-aware dan menghormati standard_certificate_id
-- ============================================================================

-- ─── 1. Normalisasi satuan ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.normalize_unit(p_unit TEXT)
RETURNS TEXT AS $$
DECLARE
    v TEXT;
BEGIN
    IF p_unit IS NULL THEN
        RETURN '';
    END IF;
    v := BTRIM(p_unit);
    v := REPLACE(v, '\circ', '°');
    v := REPLACE(v, '\degree', '°');
    v := REPLACE(v, 'mathrm', '');
    v := REPLACE(v, 'text', '');
    v := REPLACE(v, '\mu', 'µ');
    v := REPLACE(v, '\cdot', '·');
    v := REPLACE(v, '\times', '×');
    -- Buang sisa markup LaTeX: backslash, ^, {, }
    v := REPLACE(v, '\', '');
    v := REPLACE(v, '^', '');
    v := REPLACE(v, '{', '');
    v := REPLACE(v, '}', '');
    v := REPLACE(v, ' ', '');
    RETURN LOWER(v);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ─── 2. Konversi satuan (absolute: pakai offset; delta: tanpa offset) ────────
-- Faktor mengikuti sheet `konv` workbook dan lib/unitConversion.ts.
CREATE OR REPLACE FUNCTION public.unit_conversion_factor(p_from TEXT, p_to TEXT)
RETURNS DOUBLE PRECISION AS $$
DECLARE
    v_from TEXT := public.normalize_unit(p_from);
    v_to   TEXT := public.normalize_unit(p_to);
BEGIN
    IF v_from = '' OR v_to = '' THEN
        RETURN NULL;
    END IF;
    IF v_from = v_to THEN
        RETURN 1;
    END IF;

    -- Tekanan (basis hPa)
    IF v_from = 'hpa' THEN
        IF v_to = 'inhg' THEN RETURN 0.029529983071445; END IF;
        IF v_to = 'mbar' THEN RETURN 1; END IF;
        IF v_to = 'mmhg' THEN RETURN 0.750062; END IF;
        IF v_to = 'bar'  THEN RETURN 0.001; END IF;
    ELSIF v_from = 'mbar' THEN
        IF v_to = 'hpa'  THEN RETURN 1; END IF;
        IF v_to = 'inhg' THEN RETURN 0.029529983071445; END IF;
        IF v_to = 'mmhg' THEN RETURN 0.750062; END IF;
        IF v_to = 'bar'  THEN RETURN 0.001; END IF;
    ELSIF v_from = 'mmhg' THEN
        IF v_to = 'hpa'  THEN RETURN 1 / 0.750062; END IF;
        IF v_to = 'mbar' THEN RETURN 1 / 0.750062; END IF;
        IF v_to = 'inhg' THEN RETURN 1 / 25.4; END IF;
        IF v_to = 'bar'  THEN RETURN 1 / 0.750062 / 1000; END IF;
    ELSIF v_from = 'inhg' THEN
        IF v_to = 'hpa'  THEN RETURN 1 / 0.029529983071445; END IF;
        IF v_to = 'mbar' THEN RETURN 1 / 0.029529983071445; END IF;
        IF v_to = 'mmhg' THEN RETURN 25.4; END IF;
        IF v_to = 'bar'  THEN RETURN 1 / 0.029529983071445 / 1000; END IF;
    ELSIF v_from = 'bar' THEN
        IF v_to = 'hpa'  THEN RETURN 1000; END IF;
        IF v_to = 'mbar' THEN RETURN 1000; END IF;
        IF v_to = 'inhg' THEN RETURN 1000 * 0.029529983071445; END IF;
        IF v_to = 'mmhg' THEN RETURN 1000 * 0.750062; END IF;
    -- Kecepatan angin (basis m/s)
    ELSIF v_from = 'm/s' THEN
        IF v_to = 'knot' OR v_to = 'kt' THEN RETURN 1.9438444924406; END IF;
        IF v_to = 'fpm' THEN RETURN 196.850393700787; END IF;
    ELSIF v_from = 'knot' OR v_from = 'kt' THEN
        IF v_to = 'm/s' THEN RETURN 1 / 1.9438444924406; END IF;
        IF v_to = 'fpm' THEN RETURN 196.850393700787 / 1.9438444924406; END IF;
    ELSIF v_from = 'fpm' THEN
        IF v_to = 'm/s' THEN RETURN 0.00508; END IF;
        IF v_to = 'knot' OR v_to = 'kt' THEN RETURN 0.00987; END IF;
    -- Suhu
    ELSIF v_from IN ('°c', 'c') AND v_to IN ('°f', 'f') THEN
        RETURN 9.0 / 5.0;
    ELSIF v_from IN ('°f', 'f') AND v_to IN ('°c', 'c') THEN
        RETURN 5.0 / 9.0;
    -- Radiasi
    ELSIF v_from = 'w/m2' AND v_to = 'j/cm2/s' THEN
        RETURN 0.0001;
    ELSIF v_from = 'j/cm2/s' AND v_to = 'w/m2' THEN
        RETURN 10000;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Konversi absolut (dengan offset untuk suhu).
CREATE OR REPLACE FUNCTION public.convert_unit_absolute(p_value DOUBLE PRECISION, p_from TEXT, p_to TEXT)
RETURNS DOUBLE PRECISION AS $$
DECLARE
    v_from TEXT := public.normalize_unit(p_from);
    v_to   TEXT := public.normalize_unit(p_to);
    v_factor DOUBLE PRECISION;
BEGIN
    IF p_value IS NULL THEN
        RETURN NULL;
    END IF;
    v_factor := public.unit_conversion_factor(v_from, v_to);
    IF v_factor IS NULL THEN
        RETURN p_value; -- konversi tidak dikenal → biarkan apa adanya
    END IF;

    IF v_from IN ('°c', 'c') AND v_to IN ('°f', 'f') THEN
        RETURN p_value * v_factor + 32;
    ELSIF v_from IN ('°f', 'f') AND v_to IN ('°c', 'c') THEN
        RETURN (p_value - 32) * v_factor;
    END IF;

    RETURN p_value * v_factor;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ─── 3. Interpolasi koreksi standar ──────────────────────────────────────────
-- Versi dengan certificate_id eksplisit (traceability), fallback ke terbaru
-- hanya bila certificate_id tidak diberikan.
-- Hapus overload 2-arg lama agar RPC tidak memakai versi tanpa traceability.
DROP FUNCTION IF EXISTS public.hitung_koreksi(double precision, bigint);

CREATE OR REPLACE FUNCTION public.hitung_koreksi(
    reading DOUBLE PRECISION,
    sensor_std_id BIGINT,
    p_certificate_id BIGINT DEFAULT NULL
)
RETURNS DOUBLE PRECISION AS $$
DECLARE
    cert_record RECORD;
    x1 DOUBLE PRECISION;
    x2 DOUBLE PRECISION;
    y1 DOUBLE PRECISION;
    y2 DOUBLE PRECISION;
    calculated_correction DOUBLE PRECISION;
    i INT;
    len INT;
    setpoints DOUBLE PRECISION[];
    corrections DOUBLE PRECISION[];
BEGIN
    IF p_certificate_id IS NOT NULL THEN
        SELECT * INTO cert_record
        FROM certificate_standard
        WHERE id = p_certificate_id;
    ELSE
        SELECT * INTO cert_record
        FROM certificate_standard
        WHERE sensor_id = sensor_std_id
        ORDER BY calibration_date DESC
        LIMIT 1;
    END IF;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    WITH sorted_points AS (
        SELECT
            (sp.elem #>> '{}')::DOUBLE PRECISION AS setpoint,
            (cs.elem #>> '{}')::DOUBLE PRECISION AS correction_value
        FROM jsonb_array_elements(cert_record.setpoint::jsonb) WITH ORDINALITY AS sp(elem, idx)
        JOIN jsonb_array_elements(cert_record.correction_std::jsonb) WITH ORDINALITY AS cs(elem, idx)
            USING (idx)
    )
    SELECT
        array_agg(sorted_points.setpoint ORDER BY sorted_points.setpoint),
        array_agg(sorted_points.correction_value ORDER BY sorted_points.setpoint)
    INTO setpoints, corrections
    FROM sorted_points;

    len := array_length(setpoints, 1);

    IF len IS NULL OR len = 0 THEN
        RETURN NULL;
    END IF;

    IF len = 1 THEN
        RETURN corrections[1];
    END IF;

    IF reading <= setpoints[1] THEN
        RETURN corrections[1];
    END IF;

    IF reading >= setpoints[len] THEN
        RETURN corrections[len];
    END IF;

    i := 1;
    WHILE i < len LOOP
        x1 := setpoints[i];
        x2 := setpoints[i + 1];
        y1 := corrections[i];
        y2 := corrections[i + 1];

        IF reading <= x2 THEN
            EXIT;
        END IF;

        i := i + 1;
    END LOOP;

    IF x2 = x1 THEN
        RETURN y1;
    END IF;

    calculated_correction := y1 + ((reading - x1) * (y2 - y1) / (x2 - x1));

    RETURN calculated_correction;
END;
$$ LANGUAGE plpgsql;

-- ─── 4. Trigger unit-aware ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trigger_calculate_calibration()
RETURNS TRIGGER AS $$
DECLARE
    v_is_wind_direction BOOLEAN := FALSE;
    v_delta NUMERIC;
    v_std_corrected_uut NUMERIC;
BEGIN
    IF NEW.standard_data IS NOT NULL AND NEW.sensor_id_std IS NOT NULL THEN
        -- 1. Koreksi standar, memakai certificate terkunci bila tersedia.
        NEW.std_correction := public.hitung_koreksi(
            NEW.standard_data,
            NEW.sensor_id_std,
            NEW.standard_certificate_id
        );

        -- 2. Standar terkoreksi (dalam unit STD).
        NEW.std_corrected := NEW.standard_data + COALESCE(NEW.std_correction, 0);

        -- 3. Konversi standar terkoreksi ke unit UUT sebelum dikurangi UUT.
        --    (workbook: hPa→inHg, m/s→knot, dll.)
        IF NEW.uut_data IS NOT NULL THEN
            v_std_corrected_uut := public.convert_unit_absolute(
                NEW.std_corrected,
                NEW.unit_std,
                NEW.unit_uut
            );
            IF v_std_corrected_uut IS NULL THEN
                v_std_corrected_uut := NEW.std_corrected;
            END IF;

            SELECT LOWER(CONCAT_WS(
                ' ',
                s.name,
                s.type,
                COALESCE(to_jsonb(names)->>'names', to_jsonb(names)->>'name')
            )) LIKE ANY (
                ARRAY['%arah angin%', '%wind direction%', '%wind vane%']
            )
            INTO v_is_wind_direction
            FROM public.sensor s
            LEFT JOIN public.instrument_names names ON names.id = s.sensor_name_id
            WHERE s.id = NEW.sensor_id_uut;

            v_delta := v_std_corrected_uut - NEW.uut_data;
            IF COALESCE(v_is_wind_direction, FALSE) THEN
                v_delta := MOD(MOD(v_delta + 180, 360) + 360, 360) - 180;
            END IF;
            NEW.uut_correction := v_delta;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Pastikan standard_data uut tanpa STD tidak menghasilkan koreksi parsial.
-- (Trigger hanya menghitung bila STD dan UUT keduanya tersedia.)

DROP TRIGGER IF EXISTS trg_calculate_calibration ON public.raw_data;

CREATE TRIGGER trg_calculate_calibration
BEFORE INSERT OR UPDATE OF standard_data, uut_data, sensor_id_std, sensor_id_uut, standard_certificate_id, unit_std, unit_uut
ON public.raw_data
FOR EACH ROW
EXECUTE FUNCTION public.trigger_calculate_calibration();

-- ─── 5. Grant untuk pemakaian via RPC service_role ───────────────────────────
GRANT EXECUTE ON FUNCTION public.normalize_unit(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.unit_conversion_factor(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.convert_unit_absolute(double precision, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.hitung_koreksi(double precision, bigint, bigint) TO service_role;
