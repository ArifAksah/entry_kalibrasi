
ALTER TABLE instrument
ADD COLUMN station_id INTEGER REFERENCES station(id);
