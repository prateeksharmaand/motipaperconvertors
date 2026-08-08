require('dotenv').config();

/** @type {Object.<string, import('knex').Knex.Config>} */
const config = {
  development: {
    client: 'pg',
    connection: {
      host: process.env.POSTGRES_HOST ?? 'localhost',
      port: Number(process.env.POSTGRES_PORT ?? 5432),
      user: process.env.POSTGRES_USER ?? 'motipaper',
      password: process.env.POSTGRES_PASSWORD ?? 'changeme',
      database: process.env.POSTGRES_DB ?? 'motipaper',
    },
    migrations: {
      directory: './src/db/migrations',
      extension: 'ts',
      loadExtensions: ['.ts'],
    },
    seeds: {
      directory: './src/db/seeds',
      extension: 'ts',
      loadExtensions: ['.ts'],
    },
  },
  production: {
    client: 'pg',
    connection: {
      host: process.env.POSTGRES_HOST ?? 'postgres',
      port: Number(process.env.POSTGRES_PORT ?? 5432),
      user: process.env.POSTGRES_USER ?? 'motipaper',
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB ?? 'motipaper',
    },
    migrations: {
      directory: './src/db/migrations',
      extension: 'ts',
      loadExtensions: ['.ts'],
    },
    seeds: {
      directory: './src/db/seeds',
      extension: 'ts',
      loadExtensions: ['.ts'],
    },
    pool: { min: 2, max: 10 },
  },
};

module.exports = config;
