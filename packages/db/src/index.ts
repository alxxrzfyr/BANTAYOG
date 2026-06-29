/**
 * @bantayog/db — Typed Supabase clients and ER-aware query helpers.
 *
 * BE1 owns this package; FE1 imports for read-only queries.
 * This package provides:
 *   - Database type definitions (tables, enums, relationships)
 *   - Client factory functions (service client, user client)
 *   - Repository base class with typed query helpers
 *
 * See BANTAYOG_PROJECT_PLAN.md §6 (packages/db) and §7 (Supabase schema).
 */

export * from './types.js'
export * from './client.js'
export * from './repository.js'
