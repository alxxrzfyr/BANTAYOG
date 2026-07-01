/**
 * Boot script for local development.
 *
 * Checks if contract addresses exist in .env.local.
 * If missing, compiles and deploys contracts, then writes addresses back.
 *
 * Usage: tsx scripts/boot-local.ts
 */

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

const envPath = path.resolve(__dirname, '../../apps/web/.env.local')

function envHas(key: string): boolean {
  if (!fs.existsSync(envPath)) return false
  const content = fs.readFileSync(envPath, 'utf8')
  return new RegExp(`^${key}=0x`, 'm').test(content)
}

function appendEnv(key: string, value: string): void {
  const line = `\n${key}=${value}`
  fs.appendFileSync(envPath, line)
}

async function main() {
  const requiredKeys = [
    'PHPC_TOKEN_ADDRESS',
    'PHPC_SUBSIDY_ADDRESS',
    'BENEFICIARY_REGISTRY_ADDRESS',
    'MERCHANT_REGISTRY_ADDRESS',
  ]

  const allPresent = requiredKeys.every((k) => envHas(k))
  if (allPresent) {
    console.log('[boot] Contract addresses found. Skipping deploy.')
    return
  }

  console.log('[boot] Contract addresses missing. Compiling + deploying...')

  const contractsDir = path.resolve(process.cwd(), '../../packages/contracts')

  execSync('npx hardhat compile', { cwd: contractsDir, stdio: 'inherit' })
  const output = execSync(
    'npx hardhat run scripts/deploy.ts --network localhost',
    { cwd: contractsDir, encoding: 'utf8' }
  )

  // Parse addresses from deploy output
  const addresses: Record<string, string> = {}
  for (const line of output.split('\n')) {
    const match = line.match(/^(PHPC_\w+_ADDRESS|BENEFICIARY_REGISTRY_ADDRESS|MERCHANT_REGISTRY_ADDRESS)=(0x[a-fA-F0-9]{40})/i)
    if (match) addresses[match[1]] = match[2]
  }

  for (const [key, value] of Object.entries(addresses)) {
    appendEnv(key, value)
    console.log(`[boot] Wrote ${key}=${value}`)
  }
}

main().catch((err) => {
  console.error('[boot] Failed:', err)
  process.exit(1)
})
