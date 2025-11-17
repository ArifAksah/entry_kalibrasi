-- Database Schema untuk Instrument dan Sensor dengan Conditional Fields
-- Berdasarkan requirements: wmo_id, memiliki_lebih_satu, nama_alat, jenis_alat, merk, tipe, seria_number, nama_stasiun, nama_sensor, merk_sensor, tipe

-- 1. Update tabel station untuk menambahkan wmo_id (jika belum ada)
ALTER TABLE station 
ADD COLUMN IF NOT EXISTS wmo_id VARCHAR(50);

-- 2. Update tabel instrument untuk menambahkan field yang diperlukan
ALTER TABLE instrument 
ADD COLUMN IF NOT EXISTS nama_alat TEXT,
ADD COLUMN IF NOT EXISTS jenis_alat VARCHAR(100),
ADD COLUMN IF NOT EXISTS merk VARCHAR(100),
ADD COLUMN IF NOT EXISTS tipe VARCHAR(100),
ADD COLUMN IF NOT EXISTS seria_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS memiliki_lebih_satu BOOLEAN DEFAULT FALSE;

-- 3. Update tabel sensor untuk menambahkan field yang diperlukan
ALTER TABLE sensor 
ADD COLUMN IF NOT EXISTS nama_sensor VARCHAR(100),
ADD COLUMN IF NOT EXISTS merk_sensor VARCHAR(100),
ADD COLUMN IF NOT EXISTS tipe_sensor VARCHAR(100);

-- 4. Buat tabel junction untuk relasi instrument-sensor (jika memiliki lebih dari satu sensor)
CREATE TABLE IF NOT EXISTS instrument_sensors (
  id SERIAL PRIMARY KEY,
  instrument_id BIGINT NOT NULL REFERENCES instrument(id) ON DELETE CASCADE,
  sensor_id BIGINT NOT NULL REFERENCES sensor(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique combination
  UNIQUE(instrument_id, sensor_id)
);

-- 5. Buat index untuk performa
CREATE INDEX IF NOT EXISTS idx_instrument_memiliki_lebih_satu ON instrument(memiliki_lebih_satu);
CREATE INDEX IF NOT EXISTS idx_instrument_sensors_instrument_id ON instrument_sensors(instrument_id);
CREATE INDEX IF NOT EXISTS idx_instrument_sensors_sensor_id ON instrument_sensors(sensor_id);
CREATE INDEX IF NOT EXISTS idx_station_wmo_id ON station(wmo_id);

-- 6. Buat view untuk mendapatkan data lengkap instrument dengan sensor
CREATE OR REPLACE VIEW instrument_with_sensors AS
SELECT 
  i.id,
  i.created_at,
  i.nama_alat,
  i.jenis_alat,
  i.merk,
  i.tipe,
  i.seria_number,
  i.memiliki_lebih_satu,
  i.station_id,
  s.name as nama_stasiun,
  s.wmo_id,
  s.address as alamat_stasiun,
  s.latitude,
  s.longitude,
  s.elevation,
  s.time_zone,
  s.region,
  s.province,
  s.regency,
  s.type as tipe_stasiun,
  -- Sensor data (jika memiliki lebih dari satu)
  CASE 
    WHEN i.memiliki_lebih_satu = TRUE THEN
      json_agg(
        json_build_object(
          'id', sen.id,
          'nama_sensor', sen.nama_sensor,
          'merk_sensor', sen.merk_sensor,
          'tipe_sensor', sen.tipe_sensor,
          'manufacturer', sen.manufacturer,
          'type', sen.type,
          'serial_number', sen.serial_number,
          'range_capacity', sen.range_capacity,
          'range_capacity_unit', sen.range_capacity_unit,
          'graduating', sen.graduating,
          'graduating_unit', sen.graduating_unit,
          'funnel_diameter', sen.funnel_diameter,
          'funnel_diameter_unit', sen.funnel_diameter_unit,
          'volume_per_tip', sen.volume_per_tip,
          'volume_per_tip_unit', sen.volume_per_tip_unit,
          'funnel_area', sen.funnel_area,
          'funnel_area_unit', sen.funnel_area_unit,
          'name', sen.name,
          'is_standard', sen.is_standard
        )
      )
    ELSE NULL
  END as sensors
FROM instrument i
LEFT JOIN station s ON i.station_id = s.id
LEFT JOIN instrument_sensors ins ON i.id = ins.instrument_id AND i.memiliki_lebih_satu = TRUE
LEFT JOIN sensor sen ON ins.sensor_id = sen.id
GROUP BY 
  i.id, i.created_at, i.nama_alat, i.jenis_alat, i.merk, i.tipe, 
  i.seria_number, i.memiliki_lebih_satu, i.station_id,
  s.name, s.wmo_id, s.address, s.latitude, s.longitude, 
  s.elevation, s.time_zone, s.region, s.province, s.regency, s.type;

-- 7. Buat function untuk menambah sensor ke instrument
CREATE OR REPLACE FUNCTION add_sensor_to_instrument(
  p_instrument_id BIGINT,
  p_sensor_id BIGINT
) RETURNS BOOLEAN AS $$
DECLARE
  v_has_multiple BOOLEAN;
BEGIN
  -- Check if instrument has memiliki_lebih_satu = TRUE
  SELECT memiliki_lebih_satu INTO v_has_multiple
  FROM instrument 
  WHERE id = p_instrument_id;
  
  IF NOT v_has_multiple THEN
    RAISE EXCEPTION 'Instrument tidak memiliki flag memiliki_lebih_satu = TRUE';
  END IF;
  
  -- Insert relationship
  INSERT INTO instrument_sensors (instrument_id, sensor_id)
  VALUES (p_instrument_id, p_sensor_id)
  ON CONFLICT (instrument_id, sensor_id) DO NOTHING;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 8. Buat function untuk menghapus sensor dari instrument
CREATE OR REPLACE FUNCTION remove_sensor_from_instrument(
  p_instrument_id BIGINT,
  p_sensor_id BIGINT
) RETURNS BOOLEAN AS $$
BEGIN
  DELETE FROM instrument_sensors 
  WHERE instrument_id = p_instrument_id AND sensor_id = p_sensor_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 9. Buat trigger untuk memastikan konsistensi data
CREATE OR REPLACE FUNCTION check_instrument_sensor_consistency()
RETURNS TRIGGER AS $$
BEGIN
  -- Jika memiliki_lebih_satu = FALSE, hapus semua relasi sensor
  IF NEW.memiliki_lebih_satu = FALSE THEN
    DELETE FROM instrument_sensors WHERE instrument_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_instrument_sensor_consistency
  AFTER UPDATE ON instrument
  FOR EACH ROW
  EXECUTE FUNCTION check_instrument_sensor_consistency();

-- 10. Buat RLS policies untuk keamanan
ALTER TABLE instrument_sensors ENABLE ROW LEVEL SECURITY;

-- Policy untuk admin
CREATE POLICY admin_all_instrument_sensors ON instrument_sensors 
  FOR ALL 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );

-- Policy untuk user biasa
CREATE POLICY user_select_instrument_sensors ON instrument_sensors 
  FOR SELECT 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role IN ('admin', 'manager', 'user')
    )
  );

-- 11. Tambahkan komentar untuk dokumentasi
COMMENT ON COLUMN instrument.nama_alat IS 'Nama alat/instrument';
COMMENT ON COLUMN instrument.jenis_alat IS 'Jenis alat/instrument';
COMMENT ON COLUMN instrument.merk IS 'Merk alat/instrument';
COMMENT ON COLUMN instrument.tipe IS 'Tipe alat/instrument';
COMMENT ON COLUMN instrument.seria_number IS 'Nomor seri alat/instrument';
COMMENT ON COLUMN instrument.memiliki_lebih_satu IS 'Flag apakah instrument memiliki lebih dari satu sensor';

COMMENT ON COLUMN sensor.nama_sensor IS 'Nama sensor';
COMMENT ON COLUMN sensor.merk_sensor IS 'Merk sensor';
COMMENT ON COLUMN sensor.tipe_sensor IS 'Tipe sensor';

COMMENT ON COLUMN station.wmo_id IS 'WMO ID stasiun';

COMMENT ON TABLE instrument_sensors IS 'Tabel junction untuk relasi instrument-sensor (jika memiliki lebih dari satu sensor)';

-- 12. Tampilkan pesan sukses
SELECT 'Schema instrument dan sensor berhasil dibuat dengan conditional fields!' as message;










