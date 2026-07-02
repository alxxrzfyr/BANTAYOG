import { describe, it, expect } from 'vitest'
import { PinService } from './pin.service.js'

describe('PinService', () => {
  const pinService = new PinService()

  it('hashes a 6-digit PIN and verifies successfully', async () => {
    const pin = '123456'
    const hashResult = await pinService.hashPin(pin)

    expect(hashResult.isOk()).toBe(true)
    const hashed = hashResult._unsafeUnwrap()
    expect(hashed).toBeDefined()
    expect(hashed).not.toBe(pin)

    const verifyResult = await pinService.verifyPin(pin, hashed)
    expect(verifyResult.isOk()).toBe(true)
    expect(verifyResult._unsafeUnwrap()).toBe(true)
  })

  it('rejects incorrect PINs during verification', async () => {
    const pin = '123456'
    const wrongPin = '654321'
    const hashResult = await pinService.hashPin(pin)

    expect(hashResult.isOk()).toBe(true)
    const hashed = hashResult._unsafeUnwrap()

    const verifyResult = await pinService.verifyPin(wrongPin, hashed)
    expect(verifyResult.isOk()).toBe(true)
    expect(verifyResult._unsafeUnwrap()).toBe(false)
  })
})

