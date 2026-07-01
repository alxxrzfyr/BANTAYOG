#!/usr/bin/env node
// =============================================================================
// BANTAYOG — Setup Test Users
// Creates test auth users in Supabase for local development/testing.
//
// Usage:
//   node supabase/setup-test-users.js
//
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env
// =============================================================================

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load env from apps/web/.env.local (has both server and public vars)
function loadEnv() {
  const envPath = resolve(import.meta.dirname, '../apps/web/.env.local');
  const content = readFileSync(envPath, 'utf-8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    env[key] = value;
  }
  return env;
}

const env = loadEnv();
const supabaseUrl = env.SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in apps/web/.env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEST_USERS = [
  {
    email: 'admin@bantayog.test',
    password: 'TestPassword123!',
    role: 'admin',
    full_name: 'Admin Test User',
  },
  {
    email: 'merchant@bantayog.test',
    password: 'TestPassword123!',
    role: 'merchant',
    full_name: 'Merchant Test User',
  },
];

async function main() {
  console.log('Setting up test users...\n');

  for (const user of TEST_USERS) {
    // Check if user already exists
    const { data: existing } = await supabase.auth.admin.listUsers();
    const found = existing?.users?.find((u) => u.email === user.email);

    if (found) {
      console.log(`  SKIP  ${user.email} (already exists)`);
      continue;
    }

    // Create user with role in raw_app_meta_data
    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { full_name: user.full_name },
      app_metadata: { role: user.role },
    });

    if (error) {
      console.error(`  FAIL  ${user.email}: ${error.message}`);
    } else {
      console.log(`  OK    ${user.email} (role: ${user.role}, id: ${data.user.id})`);
    }
  }

  console.log('\nDone. You can now log in with the credentials above.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
