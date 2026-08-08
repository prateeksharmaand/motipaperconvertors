#!/usr/bin/env node
/**
 * Runs knex migrations and seeds using the compiled JS output.
 * Called by npm scripts so it works in both dev and production Docker.
 */
require('dotenv').config();
const knex = require('knex');
const path = require('path');

const command = process.argv[2]; // migrate | seed

const config = {
  client: 'pg',
  connection: {
    host: process.env.POSTGRES_HOST ?? 'postgres',
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    user: process.env.POSTGRES_USER ?? 'motipaper',
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB ?? 'motipaper',
  },
  migrations: {
    directory: path.join(__dirname, '../src/db/migrations'),
    extension: 'ts',
    loadExtensions: ['.ts'],
  },
  seeds: {
    directory: path.join(__dirname, '../src/db/seeds'),
    extension: 'ts',
    loadExtensions: ['.ts'],
  },
  pool: { min: 1, max: 3 },
};

// Register tsx so .ts migration files can be loaded
require('tsx/cjs');

const db = knex(config);

async function run() {
  try {
    if (command === 'migrate') {
      console.log('Running migrations…');
      const [batch, files] = await db.migrate.latest();
      if (files.length === 0) {
        console.log('Already up to date.');
      } else {
        console.log(`Batch ${batch} — ran ${files.length} migration(s):`);
        files.forEach(f => console.log(' ✔', path.basename(f)));
      }
    } else if (command === 'seed') {
      console.log('Running seeds…');
      const [files] = await db.seed.run();
      if (files.length === 0) {
        console.log('No seeds ran.');
      } else {
        console.log(`Ran ${files.length} seed(s):`);
        files.forEach(f => console.log(' ✔', path.basename(f)));
      }
    } else {
      console.error('Usage: node scripts/migrate.js [migrate|seed]');
      process.exit(1);
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

run();
