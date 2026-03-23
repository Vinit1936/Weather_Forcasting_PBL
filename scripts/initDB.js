require('dotenv').config();

const fs = require('fs/promises');
const path = require('path');
const mysql = require('mysql2/promise');

async function initDb() {
  const dbName = process.env.DB_NAME;

  if (!dbName) {
    throw new Error('DB_NAME is required in .env');
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    multipleStatements: true,
  });

  try {
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    await connection.changeUser({ database: dbName });

    const schemaPath = path.join(__dirname, '..', 'backend', 'models', 'schema.sql');
    const schemaSql = await fs.readFile(schemaPath, 'utf8');

    await connection.query(schemaSql);
    console.log(`Database initialized successfully: ${dbName}`);
  } finally {
    await connection.end();
  }
}

initDb().catch((error) => {
  console.error('Database initialization failed:', error.message);
  process.exit(1);
});
