-- Create user_stations table to store the relationship between users and stations
CREATE TABLE IF NOT EXISTS public.user_stations (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.personel(id) ON DELETE CASCADE,
  station_id INTEGER NOT NULL REFERENCES public.station(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Add unique constraint to prevent duplicate assignments
  UNIQUE(user_id, station_id)
);

-- Add comment to table
COMMENT ON TABLE public.user_stations IS 'Stores the relationship between users and stations they are assigned to';

-- Add RLS policies
ALTER TABLE public.user_stations ENABLE ROW LEVEL SECURITY;

-- Policy for admin to do everything
CREATE POLICY admin_all ON public.user_stations 
  FOR ALL 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );

-- Policy for users to view their own assignments
CREATE POLICY user_select ON public.user_stations 
  FOR SELECT 
  TO authenticated 
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role IN ('admin', 'manager')
    )
  );

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_stations_user_id ON public.user_stations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_stations_station_id ON public.user_stations(station_id);