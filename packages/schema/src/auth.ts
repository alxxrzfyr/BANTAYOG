import { z } from 'zod'

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** RBAC roles (Supabase auth custom claims). Beneficiary has no app surface in v1. */
export const UserRoleSchema = z.enum(['admin', 'merchant', 'beneficiary'])
export type UserRole = z.infer<typeof UserRoleSchema>

// ---------------------------------------------------------------------------
// Auth DTOs
// ---------------------------------------------------------------------------

/** DTO for the authenticated user profile. */
export const AuthDto = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: UserRoleSchema,
  fullName: z.string().min(1).max(200),
  createdAt: z.string().datetime(),
})
export type AuthDto = z.infer<typeof AuthDto>

/** DTO for login (email + password via Supabase Auth). */
export const LoginDto = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})
export type LoginDto = z.infer<typeof LoginDto>

/** DTO returned after successful login. */
export const AuthSessionDto = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.string().datetime(),
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    role: UserRoleSchema,
  }),
})
export type AuthSessionDto = z.infer<typeof AuthSessionDto>

/** DTO for token refresh. */
export const RefreshTokenDto = z.object({
  refreshToken: z.string().min(1),
})
export type RefreshTokenDto = z.infer<typeof RefreshTokenDto>

/** DTO for logout. */
export const LogoutDto = z.object({
  refreshToken: z.string().min(1).optional(),
})
export type LogoutDto = z.infer<typeof LogoutDto>

/** DTO for admin registration of a new auth user. */
export const RegisterAuthUserDto = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  role: z.enum(['admin', 'merchant']),
  fullName: z.string().min(1).max(200),
})
export type RegisterAuthUserDto = z.infer<typeof RegisterAuthUserDto>
