
-- Perbaiki fungsi hitung_koreksi untuk handle tipe data JSON dan kasus 1 setpoint
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
    setpoints TEXT[]; 
    corrections TEXT[];
BEGIN
    -- 1. Ambil sertifikat aktif terakhir
    SELECT * INTO cert_record
    FROM certificate_standard
    WHERE sensor_id = sensor_std_id
    ORDER BY calibration_date DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN 0; 
    END IF;

    -- 2. Konversi JSON Array ke PostgreSQL Array (TEXT[])
    -- Handle jika data NULL atau bukan array valid
    BEGIN
        SELECT ARRAY(SELECT json_array_elements_text(cert_record.setpoint::json)) INTO setpoints;
        SELECT ARRAY(SELECT json_array_elements_text(cert_record.correction_std::json)) INTO corrections;
    EXCEPTION WHEN OTHERS THEN
        RETURN 0; -- Jika format JSON salah, return 0
    END;
    
    len := array_length(setpoints, 1);
    
    IF len IS NULL OR len = 0 THEN
        RETURN 0;
    END IF;

    -- 3. Handle kasus HANYA 1 Setpoint (Offset Konstan)
    IF len = 1 THEN
        -- Jika hanya ada 1 titik kalibrasi, asumsikan koreksi konstan (offset)
        RETURN CAST(corrections[1] AS DOUBLE PRECISION);
    END IF;

    -- 4. Interpolasi Linear untuk > 1 Setpoint
    i := 1;
    -- Loop sampai len-1 karena kita butuh pasangan i dan i+1
    WHILE i < len LOOP
        x1 := CAST(setpoints[i] AS DOUBLE PRECISION);
        x2 := CAST(setpoints[i+1] AS DOUBLE PRECISION);
        y1 := CAST(corrections[i] AS DOUBLE PRECISION);
        y2 := CAST(corrections[i+1] AS DOUBLE PRECISION);

        -- Jika reading ada di segment ini (atau lebih kecil dari x2)
        IF reading <= x2 THEN
            EXIT; 
        END IF;
        
        i := i + 1;
    END LOOP;

    -- Cegah pembagian dengan nol (jika x1 == x2 secara tidak sengaja)
    IF x2 = x1 THEN
        RETURN y1;
    END IF;

    -- Rumus Interpolasi Linear
    -- y = y1 + ((x - x1) * (y2 - y1) / (x2 - x1))
    correction := y1 + ((reading - x1) * (y2 - y1) / (x2 - x1));
    
    RETURN correction;
END;
$$ LANGUAGE plpgsql;
