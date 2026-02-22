
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing env vars')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function clearRawData() {
    console.log('Clearing raw_data table...')
    const { error } = await supabase
        .from('raw_data')
        .delete()
        .neq('id', 0) // Delete all rows where id is not 0 (effectively all, assuming IDs are positive)

    if (error) {
        console.error('Error clearing data:', error)
    } else {
        console.log('Successfully cleared raw_data table.')
    }
}

clearRawData()
