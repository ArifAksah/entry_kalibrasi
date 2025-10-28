import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

export async function GET(request: NextRequest) {
  try {
    // Create user_stations table
    const { error: createTableError } = await supabase.from('user_stations').select('id').limit(1)
    
    if (createTableError?.code === '42P01') { // Table doesn't exist
      const { error } = await supabase.rpc('create_user_stations_table', {
        sql_command: `
          CREATE TABLE IF NOT EXISTS public.user_stations (
            id SERIAL PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES public.personel(id) ON DELETE CASCADE,
            station_id INTEGER NOT NULL REFERENCES public.station(id) ON DELETE CASCADE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
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
                WHERE user_roles.id = auth.uid() 
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
                WHERE user_roles.id = auth.uid() 
                AND user_roles.role IN ('admin', 'manager')
              )
            );

          -- Create index for faster lookups
          CREATE INDEX IF NOT EXISTS idx_user_stations_user_id ON public.user_stations(user_id);
          CREATE INDEX IF NOT EXISTS idx_user_stations_station_id ON public.user_stations(station_id);
        `
      })

      if (error) {
        console.error('Error creating table:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ message: 'Table created successfully' })
    }

    return NextResponse.json({ message: 'Table already exists' })
  } catch (error) {
    console.error('Error in migration:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}