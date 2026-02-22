-- Function to calculate correction using Linear Interpolation
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
    setpoints TEXT[]; -- Stored as text array in DB? Based on route.ts logging
    corrections TEXT[];
BEGIN
    -- 1. Find the latest active certificate for this sensor
    SELECT * INTO cert_record
    FROM certificate_standard
    WHERE sensor_id = sensor_std_id
    ORDER BY calibration_date DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN 0; -- No certificate found, assume 0 correction
    END IF;

    setpoints := cert_record.setpoint;
    corrections := cert_record.correction_std;
    
    len := array_length(setpoints, 1);
    
    IF len IS NULL OR len = 0 THEN
        RETURN 0;
    END IF;

    -- 2. Find bounding points (x1, x2) for the reading
    -- Assumes setpoints are sorted ascending. 
    -- If reading is below min, use first two points (extrapolation/clamping - usually linear from first segment)
    -- If reading is above max, use last two points.
    
    -- Cast text arrays to numeric for calculation
    -- Logic: Iterate to find where reading fits
    
    i := 1;
    WHILE i < len LOOP
        x1 := CAST(setpoints[i] AS DOUBLE PRECISION);
        x2 := CAST(setpoints[i+1] AS DOUBLE PRECISION);
        y1 := CAST(corrections[i] AS DOUBLE PRECISION);
        y2 := CAST(corrections[i+1] AS DOUBLE PRECISION);

        IF reading <= x2 THEN
            -- Found the segment (or it's before the first segment if i=1)
            EXIT; 
        END IF;
        
        i := i + 1;
    END LOOP;

    -- At this point, we use x1, x2, y1, y2 defined in the loop.
    -- If loop finished (reading > max), we use the last segment (i=len-1) which is set in the last iteration.
    
    -- Prevent division by zero
    IF x2 = x1 THEN
        RETURN y1;
    END IF;

    -- Linear Interpolation Formula
    -- y = y1 + ((x - x1) * (y2 - y1) / (x2 - x1))
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
