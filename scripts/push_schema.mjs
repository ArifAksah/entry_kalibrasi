import fs from 'fs';
import pg from 'pg';
const { Client } = pg;

async function pushSchema() {
  const password = 'Arifakasah12$';
  const client = new Client({
    host: 'aws-0-ap-southeast-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    user: 'postgres.vnhbfqghoijflilpadwl',
    password: password,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to dev database.');
    const sql = fs.readFileSync('production_schema.sql', 'utf8');
    
    console.log('Executing schema script...');
    await client.query(sql);
    console.log('Schema successfully pushed!');
  } catch (error) {
    console.error('Error pushing schema:', error);
  } finally {
    await client.end();
  }
}

pushSchema();
