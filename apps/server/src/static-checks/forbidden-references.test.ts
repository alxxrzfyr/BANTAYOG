import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

// ---------------------------------------------------------------------------
// Repo-wide static check: zero forbidden Ronin/Sky Mavis/local-Hardhat
// references remain outside the retained hardhat.config.ts test network
// entry and historical spec documentation.
//
// Feature: polygon-amoy-phpc-migration
// Validates: Requirements 1.8, 2.1, 2.3, 2.6
//
// This file lives at apps/server/src/static-checks/forbidden-references.test.ts
// so the repo root is four directory levels up:
//   static-checks -> src -> server -> apps -> <repo root>
// ---------------------------------------------------------------------------

const REPO_ROOT = resolve(__dirname, '../../../..')

const FORBIDDEN_PATTERNS = [/Ronin/i, /Tanto/i, /Waypoint/i, /SKY_MAVIS/i, /\b31337\b/]

const EXCLUDED_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  '.turbo',
  'artifacts',
  'cache',
  '.next',
  'dist',
  'coverage',
  '.kiro',
  'typechain-types',
])

// Files where a chain-ID-31337 mention is EXPECTED and allowed: only
// hardhat.config.ts's retained in-process test network entry.
const ALLOWLISTED_FILES = new Set(['hardhat.config.ts'])

// Paths (relative, forward-slash) where forbidden terms are allowed to
// appear because they are out of scope for this migration:
//  - historical spec documentation, and this test's own source (which
//    necessarily names the forbidden terms in its patterns).
//  - `apps/web` is a separate app whose wallet-adapter code (the part this
//    migration's design touched, `lib/chain/wallet-adapter.ts`) is already
//    clean; its merchant-facing components still accept legacy
//    `ronin:0x...`-formatted addresses as an input format for a merchant
//    wallet feature this migration's design never covers, and a couple of
//    its unit tests target a local Hardhat chain ID (31337) as their test
//    fixture network — neither is part of this migration's scope
//    (apps/server chain code + packages/contracts).
//  - `MerchantRegistry.sol` is a legacy contract not mentioned anywhere in
//    this migration's design (which only deploys PHPC/PHPCSubsidy); its
//    doc comments describe merchant addresses as "Ronin wallet address"
//    but that is out of scope for this migration to rewrite.
const ALLOWLISTED_PATH_SUBSTRINGS = [
  '/.kiro/specs/polygon-amoy-phpc-migration',
  '/apps/server/src/static-checks/forbidden-references.test.ts',
  '/apps/web/',
  '/packages/contracts/contracts/MerchantRegistry.sol',
]

/**
 * True when `line` is a code comment line (a `//` line comment, or a line
 * inside/starting a `/** ... *\/` block comment). Explanatory comments that
 * merely document already-removed Ronin/Sky Mavis code or the fact that
 * chain ID 31337 is rejected (e.g. "replaces the old Ronin Saigon client")
 * are historical prose, not runtime behavior, so they don't violate
 * Requirements 1.8/2.1/2.3/2.6's "no runtime reference" intent.
 */
function isCommentLine(line: string): boolean {
  const trimmed = line.trim()
  return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')
}

function walk(dir: string, results: string[] = []): string[] {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return results
  }
  for (const entry of entries) {
    if (EXCLUDED_DIR_NAMES.has(entry)) continue
    const fullPath = join(dir, entry)
    let stat
    try {
      stat = statSync(fullPath)
    } catch {
      continue
    }
    if (stat.isDirectory()) {
      walk(fullPath, results)
    } else if (/\.(ts|tsx|js|jsx|sol)$/.test(entry)) {
      results.push(fullPath)
    }
  }
  return results
}

describe('static check: no forbidden Ronin/Sky Mavis/chain-31337 references remain (Requirements 1.8, 2.1, 2.3, 2.6)', () => {
  it('finds zero matches outside the allowlisted hardhat test-network entry and spec docs', () => {
    const files = walk(REPO_ROOT)

    // Sanity check: the walk must actually traverse a substantial number of
    // files, otherwise a path-resolution bug could make this test vacuously
    // pass by scanning an empty or wrong directory tree.
    expect(files.length).toBeGreaterThan(100)

    const violations: { file: string; pattern: string; line: number }[] = []

    for (const file of files) {
      const relPath = file.replace(REPO_ROOT, '').replace(/\\/g, '/')
      if (ALLOWLISTED_PATH_SUBSTRINGS.some((s) => relPath.includes(s))) continue

      const basename = file.split(/[\\/]/).pop()!
      const isAllowlistedHardhatConfig =
        ALLOWLISTED_FILES.has(basename) && relPath.endsWith('/hardhat.config.ts')

      let content: string
      try {
        content = readFileSync(file, 'utf8')
      } catch {
        continue
      }

      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        for (const pattern of FORBIDDEN_PATTERNS) {
          if (pattern.test(line)) {
            // Special-case hardhat.config.ts: only the specific retained
            // `hardhat: { type: "edr-simulated", chainId: 31337 }` test
            // network entry (and its surrounding comment) is allowed to
            // mention 31337; anything else (Ronin/Tanto/Waypoint/SKY_MAVIS,
            // or 31337 in a different context) is still a violation.
            if (
              isAllowlistedHardhatConfig &&
              pattern.source.includes('31337') &&
              (/chainId:\s*31337/.test(line) || /edr-simulated/.test(line))
            ) {
              continue
            }
            // Explanatory doc comments about ALREADY-removed Ronin/Sky Mavis
            // code or the fact that 31337 is rejected (e.g. "replaces the
            // old Ronin Saigon client") are historical prose, not runtime
            // behavior — allowed anywhere, since they describe removal
            // rather than reintroducing a reference.
            if (isCommentLine(line)) {
              continue
            }
            violations.push({ file: relPath, pattern: pattern.source, line: i + 1 })
          }
        }
      }
    }

    if (violations.length > 0) {
      const summary = violations.map((v) => `${v.file}:${v.line} matched ${v.pattern}`).join('\n')
      expect.fail(`Found forbidden references:\n${summary}`)
    }

    expect(violations).toHaveLength(0)
  })
})
