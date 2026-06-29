import { describe, it, expect } from 'vitest'
import { app } from './app.js'

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.service).toBe('bantayog-server')
    expect(body.version).toBe('0.1.0')
    expect(body.timestamp).toBeDefined()
  })

  it('returns Content-Type application/json', async () => {
    const res = await app.request('/health')
    expect(res.headers.get('content-type')).toContain('application/json')
  })
})

describe('404 handler', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await app.request('/api/nonexistent')
    expect(res.status).toBe(404)

    const body = await res.json()
    expect(body.error).toBe('not_found')
  })
})

describe('CORS middleware', () => {
  it('includes CORS headers in response', async () => {
    const res = await app.request('/health', {
      headers: { Origin: 'http://localhost:3000' },
    })
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:3000')
  })
})
