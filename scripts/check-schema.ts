
import { createClient } from '@supabase/supabase-js'

// Credentials must come from the environment. Never hardcode the service-role
// key or internal host in tracked source.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_PUBLIC_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkSchema() {
    console.log('Checking calibration_session schema...')
    const { data: sessionData, error: sessionError } = await supabase
        .from('calibration_session')
        .select('*')
        .limit(1)

    if (sessionError) {
        console.error('Error fetching one row from calibration_session:', sessionError)
    } else {
        if (sessionData && sessionData.length > 0) {
            console.log('calibration_session Keys:', Object.keys(sessionData[0]))
        } else {
            console.log('calibration_session Table is empty.')
        }
    }

    console.log('Checking raw_data schema...')
    const { data: rawData, error: rawError } = await supabase
        .from('raw_data')
        .select('*')
        .limit(1)

    if (rawError) {
        console.error('Error fetching one row from raw_data:', rawError)
    } else {
        if (rawData && rawData.length > 0) {
            console.log('raw_data Keys:', Object.keys(rawData[0]))
        } else {
            // Try to force error to see columns if table is empty? 
            // Or assume columns are missing if we can't see them.
            // Let's print the error if any, otherwise just logical deduction.
            console.log('raw_data Table is empty.')
        }
    }
}

checkSchema()
