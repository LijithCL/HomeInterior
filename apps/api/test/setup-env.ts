import * as dotenv from 'dotenv';
import * as path from 'node:path';

// Load the real .env for everything else (JWT secrets, storage paths,
// etc.), but point DATABASE_URL at a dedicated test database — e2e tests
// create/mutate real rows, and running them against the dev database
// would pollute or race with whatever you're doing manually in the app.
// Run `createdb homeinterior_test && DATABASE_URL=...homeinterior_test
// pnpm prisma migrate deploy` once before running e2e tests (see README).
dotenv.config({ path: path.resolve(__dirname, '../.env') });

if (process.env.DATABASE_URL) {
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = '/homeinterior_test';
  process.env.DATABASE_URL = url.toString();
}
