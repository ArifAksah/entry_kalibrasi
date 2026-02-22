const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Manually read .env.local
let env = {};
try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
        }
    });
} catch (e) {
    console.error('Could not read .env.local', e);
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

console.log('URL:', supabaseUrl);
console.log('Key exists:', !!supabaseServiceKey);
console.log('Key length:', supabaseServiceKey ? supabaseServiceKey.length : 0);

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testInsert() {
    try {
        console.log('Attempting insert...');
        const { data, error } = await supabase
            .from('calibration_sessions')
            .insert([
                {
                    station_id: 1,
                    start_date: '2023-01-01',
                    status: 'draft',
                    created_at: new Date().toISOString()
                }
            ])
            .select()
            .single();

        if (error) {
            console.error('Supabase Error:', error);
            const util = require('util');
            console.log('Error Inspect:', util.inspect(error));
        } else {
            console.log('Success:', data);
        }
    } catch (e) {
        console.error('Exception:', e);
    }
}

testInsert();
