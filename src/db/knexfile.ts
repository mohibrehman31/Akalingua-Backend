import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Check that .env exists at the project root.",
  );
}

const config = {
  client: "pg",
  connection: {
    connectionString: process.env.DATABASE_URL,
    ssl:
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: true }
        : false,
  },
  migrations: {
    tableName: "knex_migrations",
    directory: "./migrations",
    extension: "ts",
  },
  seeds: {
    directory: "./seeds",
    extension: "ts",
  },
};

export default config;
module.exports = config;
