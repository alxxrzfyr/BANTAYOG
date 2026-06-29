/**
 * Hono environment bindings type.
 *
 * BE1 owns this file. All env vars consumed by the server are typed here.
 * Chain/ronin vars are contributed by BE2 but still typed here for completeness.
 */

export interface Env {
  // Supabase
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  SUPABASE_SERVICE_ROLE_KEY: string

  // Auth / JWT
  JWT_SIGNING_SECRET: string

  // Upstash
  UPSTASH_REDIS_REST_URL: string
  UPSTASH_REDIS_REST_TOKEN: string

  // Vercel Cron
  CRON_SECRET: string

  // Gemini (BE2 owns)
  GEMINI_API_KEY: string

  // Ronin / Chain (BE2 owns)
  RONIN_SAIGON_RPC_URL: string
  RONIN_SAIGON_CHAIN_ID: string
  DEPLOYER_PRIVATE_KEY: string

  // Deployed contract addresses (BE2 populates after deploy)
  PHPC_TOKEN_ADDRESS: string
  PHPC_SUBSIDY_ADDRESS: string
  BENEFICIARY_REGISTRY_ADDRESS: string
  MERCHANT_REGISTRY_ADDRESS: string

  // Optional
  CORS_ORIGIN?: string
  PORT?: string
}
