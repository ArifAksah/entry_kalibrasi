import fs from 'fs';
import pg from 'pg';
const { Client } = pg;

async function pushSchema() {
  // Credentials come from the environment only.
  const client = new Client(
    process.env.DATABASE_URL
      ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
      : {
          host: process.env.DB_HOST,
          port: Number(process.env.DB_PORT || 6543),
          database: process.env.DB_NAME || 'postgres',
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
          ssl: { rejectUnauthorized: false },
        },
  );

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
