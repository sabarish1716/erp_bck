-- =====================================================
-- Supabase Tables for Driver Tracker
-- Run this in your Supabase SQL Editor
-- =====================================================

-- 1. Driver Locations — stores real-time GPS pings from driver app
CREATE TABLE IF NOT EXISTS driver_locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id TEXT NOT NULL,
  bus_id TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  speed DOUBLE PRECISION,
  mileage_km DOUBLE PRECISION DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_driver_locations_driver ON driver_locations (driver_id);
CREATE INDEX idx_driver_locations_created ON driver_locations (created_at DESC);
CREATE INDEX idx_driver_locations_bus ON driver_locations (bus_id);

-- 2. Driver Mileage — daily accumulated GPS mileage per driver
CREATE TABLE IF NOT EXISTS driver_mileage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id TEXT NOT NULL,
  bus_id TEXT,
  total_km DOUBLE PRECISION NOT NULL DEFAULT 0,
  date DATE NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (driver_id, date)
);

CREATE INDEX idx_driver_mileage_driver ON driver_mileage (driver_id);
CREATE INDEX idx_driver_mileage_date ON driver_mileage (date);

-- 3. Drivers — synced driver status for real-time dashboard
CREATE TABLE IF NOT EXISTS drivers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT,
  bus_id TEXT,
  status TEXT DEFAULT 'ACTIVE',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_drivers_driver_id ON drivers (driver_id);
CREATE INDEX idx_drivers_phone ON drivers (phone);

-- 4. Enable Row Level Security (RLS) — allow public inserts from Flutter app
ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_mileage ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;

-- Policy: Allow inserts from anon/authenticated users
CREATE POLICY "Allow insert driver_locations" ON driver_locations FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow select driver_locations" ON driver_locations FOR SELECT USING (true);

CREATE POLICY "Allow insert driver_mileage" ON driver_mileage FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update driver_mileage" ON driver_mileage FOR UPDATE USING (true);
CREATE POLICY "Allow select driver_mileage" ON driver_mileage FOR SELECT USING (true);

CREATE POLICY "Allow insert drivers" ON drivers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update drivers" ON drivers FOR UPDATE USING (true);
CREATE POLICY "Allow select drivers" ON drivers FOR SELECT USING (true);

-- 5. Fuel Logs — synced from driver app and backend
CREATE TABLE IF NOT EXISTS fuel_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id TEXT NOT NULL,
  bus_id TEXT,
  plate_no TEXT,
  odometer DOUBLE PRECISION NOT NULL,
  litres DOUBLE PRECISION NOT NULL,
  fuel_cost_per_litre DOUBLE PRECISION,
  total_cost DOUBLE PRECISION,
  note TEXT,
  image_url TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fuel_logs_driver ON fuel_logs (driver_id);
CREATE INDEX idx_fuel_logs_bus ON fuel_logs (bus_id);
CREATE INDEX idx_fuel_logs_timestamp ON fuel_logs (timestamp DESC);

ALTER TABLE fuel_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow insert fuel_logs" ON fuel_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow select fuel_logs" ON fuel_logs FOR SELECT USING (true);
CREATE POLICY "Allow update fuel_logs" ON fuel_logs FOR UPDATE USING (true);

-- 6. Storage bucket for fuel receipt images
INSERT INTO storage.buckets (id, name, public)
VALUES ('fuel-receipts', 'fuel-receipts', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to upload to the fuel-receipts bucket
CREATE POLICY "Allow public upload fuel-receipts"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'fuel-receipts');

-- Allow anyone to read from the fuel-receipts bucket
CREATE POLICY "Allow public read fuel-receipts"
ON storage.objects FOR SELECT
USING (bucket_id = 'fuel-receipts');

-- 7. Enable Realtime on location table for live tracking
ALTER PUBLICATION supabase_realtime ADD TABLE driver_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE drivers;
ALTER PUBLICATION supabase_realtime ADD TABLE fuel_logs;
