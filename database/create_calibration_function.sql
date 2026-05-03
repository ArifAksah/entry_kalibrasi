-- Function to calculate correction using Linear Interpolation
-- setpoint and correction_std are stored as JSON arrays (e.g. ["700","750","800"])
CREATE OR REPLACE FUNCTION public.hitung_koreksi(reading DOUBLE PRECISION, sensor_std_id BIGINT)
RETURNS DOUBLE PRECISION AS $$
DECLARE
    cert_record RECORD;
    x1 DOUBLE PRECISION;
    x2 DOUBLE PRECISION;
    y1 DOUBLE PRECISION;
    y2 DOUBLE PRECISION;
    correction DOUBLE PRECISION;
    i INT;
    len INT;
    setpoints DOUBLE PRECISION[];
    corrections DOUBLE PRECISION[];
BEGIN
    -- 1. Find the latest active certificate for this sensor
    SELECT * INTO cert_record
    FROM certificate_standard
    WHERE sensor_id = sensor_std_id
    ORDER BY calibration_date DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN 0;
    END IF;

    -- Parse JSON arrays into paired DOUBLE PRECISION arrays, sorted by setpoint.
    -- The certificate input order can be arbitrary, so keep correction_std paired
    -- by original array index, then sort both arrays by setpoint before interpolating.
    WITH sorted_points AS (
        SELECT
            (sp.elem #>> '{}')::DOUBLE PRECISION AS setpoint,
            (cs.elem #>> '{}')::DOUBLE PRECISION AS correction
        FROM jsonb_array_elements(cert_record.setpoint::jsonb) WITH ORDINALITY AS sp(elem, idx)
        JOIN jsonb_array_elements(cert_record.correction_std::jsonb) WITH ORDINALITY AS cs(elem, idx)
            USING (idx)
    )
    SELECT
        array_agg(setpoint ORDER BY setpoint),
        array_agg(correction ORDER BY setpoint)
    INTO setpoints, corrections
    FROM sorted_points;

    len := array_length(setpoints, 1);

    IF len IS NULL OR len = 0 THEN
        RETURN 0;
    END IF;

    -- Edge case: only one setpoint
    IF len = 1 THEN
        RETURN corrections[1];
    END IF;

    -- 2. Find bounding segment for linear interpolation
    -- Default to first segment (handles reading < min setpoint)
    x1 := setpoints[1];
    x2 := setpoints[2];
    y1 := corrections[1];
    y2 := corrections[2];

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

    -- Prevent division by zero
    IF x2 = x1 THEN
        RETURN y1;
    END IF;

    -- Linear Interpolation: y = y1 + (x - x1) * (y2 - y1) / (x2 - x1)
    correction := y1 + ((reading - x1) * (y2 - y1) / (x2 - x1));

    RETURN correction;
END;
$$ LANGUAGE plpgsql;

-- Trigger Function to update row
CREATE OR REPLACE FUNCTION public.trigger_calculate_calibration()
RETURNS TRIGGER AS $$
BEGIN
    -- Only calculate if we have standard data and a standard sensor ID
    IF NEW.standard_data IS NOT NULL AND NEW.sensor_id_std IS NOT NULL THEN
        -- 1. Calculate Standard Correction (k_sert)
        NEW.std_correction := public.hitung_koreksi(NEW.standard_data, NEW.sensor_id_std);
        
        -- 2. Calculate Corrected Standard Value (t_std_terkoreksi)
        NEW.std_corrected := NEW.standard_data + COALESCE(NEW.std_correction, 0);
        
        -- 3. Calculate UUT Correction (t_i_koreksi)
        -- t_i_koreksi = t_std_terkoreksi - t_alat (uut_data)
        IF NEW.uut_data IS NOT NULL THEN
            NEW.uut_correction := NEW.std_corrected - NEW.uut_data;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create Trigger
DROP TRIGGER IF EXISTS trg_calculate_calibration ON public.raw_data;

CREATE TRIGGER trg_calculate_calibration
BEFORE INSERT OR UPDATE OF standard_data, uut_data, sensor_id_std
ON public.raw_data
FOR EACH ROW
EXECUTE FUNCTION public.trigger_calculate_calibration();
