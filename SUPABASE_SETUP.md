# Supabase Setup Instructions

## 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up or log in to your account
3. Click "New Project"
4. Choose your organization
5. Enter project details:
   - Name: `entry-kalibrasi`
   - Database Password: (choose a strong password)
   - Region: (choose closest to your location)
6. Click "Create new project"

## 2. Create Database Table

Once your project is ready, go to the SQL Editor and run this SQL:

```sql
-- Create sensor_names table
CREATE TABLE sensor_names (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  name TEXT NOT NULL UNIQUE
);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_sensor_names_updated_at 
    BEFORE UPDATE ON sensor_names 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample data
INSERT INTO sensor_names (name) VALUES 
  ('Temperature Sensor'),
  ('Humidity Sensor'),
  ('Pressure Sensor'),
  ('Light Sensor');
```

## 3. Get API Keys

1. Go to Settings > API
2. Copy the following values:
   - Project URL
   - Anon public key

## 4. Configure Environment Variables

Create a `.env.local` file in the project root with:

```env
NEXT_PUBLIC_SUPABASE_URL=your_project_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

## 5. Test the Connection

1. Start the development server: `npm run dev`
2. Open the dashboard
3. Navigate to the "Sensor Names" section
4. Try creating, editing, and deleting sensor names

## Troubleshooting

- Make sure your Supabase project is active
- Check that the table was created successfully
- Verify your environment variables are correct
- Check the browser console for any errors
