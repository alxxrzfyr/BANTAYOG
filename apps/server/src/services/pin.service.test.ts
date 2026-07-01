import { describe, it, expect } from 'vitest'
import { PinService } from './pin.service.js'

describe('PinService', () => {
  const pinService = new PinService()

  it('hashes a 6-digit PIN and verifies successfully', async () => {
    const pin = '123456'
    const hashed = await pinService.hashPin(pin)

    expect(hashed).toBeDefined()
    expect(hashed).not.toBe(pin)

    const isValid = await pinService.verifyPin(pin, hashed)
    expect(isValid).toBe(true)
  })

  it('rejects incorrect PINs during verification', async () => {
    const pin = '123456'
    const wrongPin = '654321'
    const hashed = await pinService.hashPin(pin)

    const isValid = await pinService.verifyPin(wrongPin, hashed)
    expect(isValid).toBe(false)
  })
})
