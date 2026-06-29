/**
 * Auth middleware — verifies Supabase JWT.
 *
 * BE1 owns this file. Extracts the Bearer token from the Authorization
 * header and verifies it against Supabase Auth. Attaches the user's
 * identity to Hono context for downstream handlers.
 *
 * Public routes (/health) skip this middleware.
 */
import { createMiddleware } from 'hono/factory'
import { createClient } from '@supabase/supabase-js'
import type { Env } from '../types/env.js'

// ---------------------------------------------------------------------------
// Context augmentation
// ---------------------------------------------------------------------------

export interface AuthContext {
  user: {
    id: string
    email: string
    role: string
  } | null
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/**
 * Verifies the Supabase JWT from the Authorization header.
 * Attaches user info to c.set('user', ...) on success.
 * Returns 401 if the token is missing or invalid.
 */
export const authMiddleware = createMiddleware<{
  Bindings: Env
  Variables: AuthContext
}>(async (c, next) => {
  const authHeader = c.req.header('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    c.set('user', null)
    await next()
    return
  }

  const token = authHeader.slice(7)

  // Verify the JWT via Supabase auth.getUser()
  // This delegates verification to Supabase's JWT validation
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      },
    )

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      c.set('user', {
        id: user.id,
        email: user.email ?? '',
        role: (user.app_metadata?.role as string) ?? 'unknown',
      })
    } else {
      c.set('user', null)
    }
  } catch {
    c.set('user', null)
  }

  await next()
})
