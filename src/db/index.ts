import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;

// Cache the database connection in development to avoid max clients error
const globalForDb = globalThis as unknown as {
    pool: postgres.Sql | undefined;
};

export const client = globalForDb.pool ?? postgres(connectionString);

if (process.env.NODE_ENV !== "production") {
    globalForDb.pool = client;
}

export const db = drizzle(client, { schema });
