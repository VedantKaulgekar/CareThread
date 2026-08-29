const { Pool } = require("pg");
require("dotenv").config();

/*
|--------------------------------------------------------------------------
| DATABASE CONFIGURATION
|--------------------------------------------------------------------------
*/

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set in server/.env"
  );
}

/*
|--------------------------------------------------------------------------
| POSTGRESQL CONNECTION POOL
|--------------------------------------------------------------------------
*/

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  ssl: {
    rejectUnauthorized: false,
  },

  max: 10,

  idleTimeoutMillis: 30000,

  connectionTimeoutMillis: 10000,
});

/*
|--------------------------------------------------------------------------
| DATABASE ERROR HANDLER
|--------------------------------------------------------------------------
*/

pool.on("error", (err) => {
  console.error(
    "Unexpected PostgreSQL pool error:",
    err
  );
});

/*
|--------------------------------------------------------------------------
| TEST DATABASE CONNECTION
|--------------------------------------------------------------------------
*/

async function testDatabaseConnection() {
  try {
    const result = await pool.query(
      "SELECT NOW() AS now"
    );

    console.log(
      "PostgreSQL connected successfully:",
      result.rows[0].now
    );
  } catch (error) {
    console.error(
      "PostgreSQL connection failed:",
      error.message
    );
  }
}

testDatabaseConnection();

/*
|--------------------------------------------------------------------------
| EXPORT
|--------------------------------------------------------------------------
*/

module.exports = pool;