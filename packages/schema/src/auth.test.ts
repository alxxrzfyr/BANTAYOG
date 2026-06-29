import { describe, it, expect } from 'vitest'
import {
  UserRoleSchema,
  LoginDto,
  AuthSessionDto,
  RefreshTokenDto,
  LogoutDto,
  RegisterAuthUserDto,
} from './auth.js'

describe('UserRoleSchema', () => {
  it('accepts all valid roles', () => {
    const valid = ['admin', 'merchant', 'beneficiary']
    for (const r of valid) {
      expect(UserRoleSchema.parse(r)).toBe(r)
    }
  })

  it('rejects an invalid role', () => {
    expect(() => UserRoleSchema.parse('superuser')).toThrow()
  })
})

describe('LoginDto', () => {
  it('accepts valid email and password', () => {
    expect(
      LoginDto.safeParse({ email: 'admin@bantayog.gov.ph', password: 'secret123' }).success,
    ).toBe(true)
  })

  it('rejects invalid email', () => {
    expect(
      LoginDto.safeParse({ email: 'not-an-email', password: 'secret123' }).success,
    ).toBe(false)
  })

  it('rejects empty password', () => {
    expect(
      LoginDto.safeParse({ email: 'admin@bantayog.gov.ph', password: '' }).success,
    ).toBe(false)
  })
})

describe('AuthSessionDto', () => {
  const validInput = {
    accessToken: 'eyJhbGciOiJIUzI1NiJ9.payload.signature',
    refreshToken: 'refresh-token-string',
    expiresAt: '2026-06-29T01:00:00Z',
    user: {
      id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      email: 'admin@bantayog.gov.ph',
      role: 'admin',
    },
  }

  it('accepts a valid session', () => {
    expect(AuthSessionDto.safeParse(validInput).success).toBe(true)
  })

  it('accepts merchant role', () => {
    expect(
      AuthSessionDto.safeParse({
        ...validInput,
        user: { ...validInput.user, role: 'merchant' },
      }).success,
    ).toBe(true)
  })

  it('rejects invalid expiresAt (not ISO datetime)', () => {
    expect(
      AuthSessionDto.safeParse({ ...validInput, expiresAt: 'tomorrow' }).success,
    ).toBe(false)
  })

  it('rejects invalid user id (not UUID)', () => {
    expect(
      AuthSessionDto.safeParse({
        ...validInput,
        user: { ...validInput.user, id: 'not-a-uuid' },
      }).success,
    ).toBe(false)
  })
})

describe('RefreshTokenDto', () => {
  it('accepts valid refresh token', () => {
    expect(RefreshTokenDto.safeParse({ refreshToken: 'some-token' }).success).toBe(true)
  })

  it('rejects empty refresh token', () => {
    expect(RefreshTokenDto.safeParse({ refreshToken: '' }).success).toBe(false)
  })
})

describe('LogoutDto', () => {
  it('accepts with refreshToken', () => {
    expect(LogoutDto.safeParse({ refreshToken: 'some-token' }).success).toBe(true)
  })

  it('accepts without refreshToken (optional)', () => {
    expect(LogoutDto.safeParse({}).success).toBe(true)
  })
})

describe('RegisterAuthUserDto', () => {
  it('accepts valid admin registration', () => {
    expect(
      RegisterAuthUserDto.safeParse({
        email: 'newadmin@bantayog.gov.ph',
        password: 'strongpassword123',
        role: 'admin',
        fullName: 'Juan dela Cruz',
      }).success,
    ).toBe(true)
  })

  it('accepts valid merchant registration', () => {
    expect(
      RegisterAuthUserDto.safeParse({
        email: 'merchant@example.com',
        password: 'strongpassword123',
        role: 'merchant',
        fullName: 'Nena Cruz',
      }).success,
    ).toBe(true)
  })

  it('rejects beneficiary role (no app surface in v1)', () => {
    expect(
      RegisterAuthUserDto.safeParse({
        email: 'test@example.com',
        password: 'strongpassword123',
        role: 'beneficiary',
        fullName: 'Test',
      }).success,
    ).toBe(false)
  })

  it('rejects password shorter than 8 chars', () => {
    expect(
      RegisterAuthUserDto.safeParse({
        email: 'test@example.com',
        password: 'short',
        role: 'admin',
        fullName: 'Test',
      }).success,
    ).toBe(false)
  })

  it('rejects empty fullName', () => {
    expect(
      RegisterAuthUserDto.safeParse({
        email: 'test@example.com',
        password: 'strongpassword123',
        role: 'admin',
        fullName: '',
      }).success,
    ).toBe(false)
  })
})
