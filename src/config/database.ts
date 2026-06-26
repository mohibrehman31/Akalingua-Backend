import knex from 'knex';
import { types as pgTypes } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// The frontend contract returns money amounts as JSON numbers (e.g. 24, 55.5),
// but node-postgres returns NUMERIC/DECIMAL columns as strings by default.
// Parse them to floats so rates/budgets/fees serialise as numbers, not strings.
pgTypes.setTypeParser(1700 /* NUMERIC */, (val) => (val === null ? null : parseFloat(val)));

const db = knex({
  client: 'pg',
  connection: {
    connectionString: process.env.DATABASE_URL,
    // DB_SSL, not NODE_ENV: the internal Postgres container has no TLS. Set DB_SSL=true for managed DBs (RDS).
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false,
  },
  pool: {
    min: 2,
    max: 10,
  },
  migrations: {
    tableName: 'knex_migrations',
    directory: '../db/migrations',
  },
  seeds: {
    directory: '../db/seeds',
  },
});

export default db;