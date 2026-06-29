/**
 * Typed Supabase client factory functions.
 *
 * BE1 owns this file. Provides typed Supabase clients using the
 * Database interface from types.ts. These clients enforce type safety
 * at compile time for all table operations.
 *
 * Usage:
 *   import { createServiceDbClient } from '@bantayog/db'
 *   const db = createServiceDbClient()
 *   const { data } = await db.from('merchants').select('*')
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './types.js'

// ---------------------------------------------------------------------------
// Client factories
// ---------------------------------------------------------------------------

/**
 * Creates a typed Supabase client with the service role key.
 * Bypasses RLS — use only for privileged server operations.
 *
 * NEVER expose this client to the frontend.
 */
export function createServiceDbClient(): SupabaseClient<Database> {
  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error(
      'Missing Supabase env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set',
    )
  }

  return createClient<Database>(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

/**
 * Creates a typed Supabase client with the anon key, authenticated
 * with the user's JWT. RLS policies are enforced.
 */
export function createUserDbClient(jwt: string): SupabaseClient<Database> {
  const url = process.env.SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error(
      'Missing Supabase env vars: SUPABASE_URL and SUPABASE_ANON_KEY must be set',
    )
  }

  return createClient<Database>(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    },
  })
}

// ---------------------------------------------------------------------------
// Singleton service client (lazy init)
// ---------------------------------------------------------------------------

let _serviceDbClient: SupabaseClient<Database> | null = null

/**
 * Returns a lazily-initialized singleton service client.
 * Use this in services/lib where a long-lived client is appropriate.
 */
export function getServiceDbClient(): SupabaseClient<Database> {
  if (!_serviceDbClient) {
    _serviceDbClient = createServiceDbClient()
  }
  return _serviceDbClient
}
