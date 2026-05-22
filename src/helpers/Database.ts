import { Pool } from 'pg'

let pool: Pool | null = null

/**
 * Returns the shared PostgreSQL connection pool.
 * Connects to Neon using the DATABASE_URL environment variable.
 * Returns null if DATABASE_URL is not set (local mode fallback).
 */
export function getPool(): Pool | null {
    if (!process.env.DATABASE_URL) {
        return null
    }

    if (!pool) {
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false },
            max: 5,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000
        })
    }

    return pool
}

/**
 * Returns true if the bot is running in cloud/CI mode (DATABASE_URL is set).
 */
export function isCloudMode(): boolean {
    return !!process.env.DATABASE_URL
}

/**
 * Initializes the database tables if they do not exist.
 * Called once during bot startup when DATABASE_URL is present.
 */
export async function initDB(): Promise<void> {
    const db = getPool()
    if (!db) return

    await db.query(`
        CREATE TABLE IF NOT EXISTS sessions (
            email TEXT NOT NULL,
            type TEXT NOT NULL,
            data JSONB NOT NULL,
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            PRIMARY KEY (email, type)
        );
    `)

    await db.query(`
        CREATE TABLE IF NOT EXISTS run_logs (
            id SERIAL PRIMARY KEY,
            run_id TEXT NOT NULL,
            timestamp TIMESTAMPTZ DEFAULT NOW(),
            level TEXT NOT NULL,
            title TEXT NOT NULL,
            platform TEXT,
            username TEXT,
            message TEXT NOT NULL,
            points_data JSONB
        );
    `)

    console.log('[DATABASE] Connected to Neon Postgres - tables initialized')
}

/**
 * Closes the connection pool gracefully.
 */
export async function closeDB(): Promise<void> {
    if (pool) {
        await pool.end()
        pool = null
    }
}
