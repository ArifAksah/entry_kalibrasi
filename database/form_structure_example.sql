-- Example form structure for instrument with conditional sensor fields
-- This shows how the fields should be organized based on the database schema

/*
FORM STRUCTURE:

=== STATION INFORMATION ===
- wmo_id (from station.station_wmo_id)
- nama_stasiun (from station.name)

=== INSTRUMENT INFORMATION ===
- nama_alat (from instrument.name)
- jenis_alat (from instrument.type)
- merk (from instrument.manufacturer)
- tipe (from instrument.type)
- seria_number (from instrument.serial_number)
- memiliki_lebih_satu (from instrument.memiliki_lebih_satu) [CHECKBOX/TOGGLE]

=== SENSOR INFORMATION (CONDITIONAL) ===
[Only shown when memiliki_lebih_satu = true]
- nama_sensor (from sensor.name)
- merk_sensor (from sensor.manufacturer)
- tipe (from sensor.type)
- serial_number (from sensor.serial_number)
- range_capacity (from sensor.range_capacity)
- range_capacity_unit (from sensor.range_capacity_unit)
- graduating (from sensor.graduating)
- graduating_unit (from sensor.graduating_unit)
- funnel_diameter (from sensor.funnel_diameter)
- funnel_diameter_unit (from sensor.funnel_diameter_unit)
- volume_per_tip (from sensor.volume_per_tip)
- volume_per_tip_unit (from sensor.volume_per_tip_unit)
- funnel_area (from sensor.funnel_area)
- funnel_area_unit (from sensor.funnel_area_unit)
- is_standard (from sensor.is_standard)

=== RELATIONSHIPS ===
- instrument.station_id → station.id
- sensor.instrument_id → instrument.id
*/
