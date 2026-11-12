# PayPal AI Hackathon 2026: PayPal platform reference

Verified on 2026-11-11 against developer.paypal.com, the `paypal/agent-toolkit` repo and the npm
registry. Items in "Re-check before you rely on it" are not verified. Do not treat them as fact.

## Sandbox only

Use the PayPal sandbox for all hackathon work. This rule matches the Stellar testnet-only rule.

- Use `https://api-m.sandbox.paypal.com` and `https://mcp.sandbox.paypal.com`.
- Never use `https://api-m.paypal.com`, `https://mcp.paypal.com` or live credentials.
- PayPal's LLM-integration samples (`/ai-tools/build-with-llm`) use the production hosts. Change
  them to the sandbox hosts before you copy them.

## Where PayPal code goes in this repo

- Put PayPal HTTP calls in `apps/server`, in a `paypal.gateway.ts` behind a service that returns
  `AppResult<T>`. Use `fetch`.
- `apps/web` may show the buyer approval and return pages. It calls the server through the
  proxy. Keep PayPal business logic and secrets out of `apps/web`. Only the client ID may be
  public, and only for the PayPal JS SDK button.
- Read credentials in one config loader, like `apps/server/src/lib/chain/config.ts`. Add each new
  variable to `turbo.json#globalEnv`, the `.env.example` files and `apps/server/src/types/env.ts`.
- Use the names `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`. PayPal samples mix in
  `PAYPAL_SECRET`. Keep one name set.
- Credits move only through `settle_sale`. A PayPal flow must not change balances in TypeScript.
- Send deterministic `PayPal-Request-Id` values on invoice create and send. Do not send this
  header on the OAuth token request. See ADR 006 for the Invoicing v2 source review.
- Add the PayPal secrets to `collectConfiguredSecrets` and use `redactSecrets`
  (`apps/server/src/lib/redact.ts`) around PayPal calls.

## Sandbox setup

1. Log in at https://developer.paypal.com/dashboard/. The first login creates a default sandbox
   personal (buyer) account and business (seller) account.
2. Open Apps & Credentials. Select Sandbox. Create an app on the business account.
3. Copy the client ID and the secret.
4. Get a token:
   `POST https://api-m.sandbox.paypal.com/v1/oauth2/token` with Basic auth
   `CLIENT_ID:CLIENT_SECRET` and the form body `grant_type=client_credentials`.
5. The token lasts 3 to 8 hours (README text). Refresh it before 3 hours. An expired token during
   a demo breaks every call.

Sandbox test emails look like `sb-<random>@personal.example.com`. Starter repo:
https://github.com/paypaldev/getting-started-with-paypal-sandbox.

## Orders v2 (checkout)

- Create: `POST /v2/checkout/orders` with `intent` (`CAPTURE` or `AUTHORIZE`) and `purchase_units`
  (1 to 10). Each amount needs `currency_code` and `value` (a string).
- The buyer approves through the response link (`rel: "approve"`, or `rel: "payer-action"` when the
  PayPal wallet needs a buyer step). Approval needs a browser.
- Capture: `POST /v2/checkout/orders/{id}/capture`.
- `PHP` is in the supported-currency table. It is not zero-decimal and not in-country-only.

```json
{ "intent": "CAPTURE", "purchase_units": [{ "amount": { "currency_code": "PHP", "value": "50.00" } }] }
```

## Payouts (disbursements)

- `POST /v1/payments/payouts`. Up to 15,000 items for each call.
- The Philippines can send payouts. `PHP` has automatic conversion.
- `recipient_type`: `EMAIL`, `PHONE`, `PAYPAL_ID` or `USER_HANDLE` (Venmo, US only). The sandbox
  does not support `PHONE`. Use `EMAIL` in tests.
- The recipient needs a PayPal account. Unclaimed payouts return after 30 days.
- The Agent Toolkit has no Payouts tool. Call the REST API directly.

## Agent Toolkit

- Package `@paypal/agent-toolkit` 1.11.0 (npm), `paypal-agent-toolkit` 1.11.0 (PyPI, Python
  3.11+). Node 18+. The GitHub "latest release" shows v1.8.0. Use the registry version.
- Adapters: `@paypal/agent-toolkit/ai-sdk`, `/openai`, `/langchain`, `/mcp`, `/bedrock`.
- The toolkit depends on `ai ^4.0.23`. The npm `ai` package is at v7. Test the tool format with the
  model client before you build on it.
- Repo license: Apache-2.0. The npm `package.json` says ISC.

```ts
import { PayPalAgentToolkit } from '@paypal/agent-toolkit/ai-sdk';

const paypal = new PayPalAgentToolkit({
  clientId: process.env.PAYPAL_CLIENT_ID,
  clientSecret: process.env.PAYPAL_CLIENT_SECRET,
  configuration: {
    actions: { orders: { create: true, get: true, capture: true } },
    context: { sandbox: true },
  },
});
// generateText({ model, tools: paypal.getTools(), maxSteps: 10, prompt })
```

- Set `context.sandbox: true`. The quickstart route omits it.
- The tool `pay_order` needs `orders: { capture: true }`.
- Tool names: `create_order`, `get_order`, `pay_order`, `create_refund`, `get_refund`. The
  quickstart prompt names `capture_order` and `get_order_status`. Those tools do not exist.
- The TypeScript README lists 43 tools: Invoices 20, Payments 5, Disputes 3, Shipment tracking 3,
  Catalog 3, Subscriptions 7, Reporting 2. The Python package lists 40.

The `ai-sdk` adapter gives tools to an AI SDK model call. The repo uses Gemini through
`@google/genai`, not the AI SDK. To join them, add an AI SDK Google provider, or call the PayPal
tools through MCP. Test either path before you depend on it.

## MCP server

- Local: `npx -y @paypal/mcp --tools=all` (package 1.8.1) with env `PAYPAL_ACCESS_TOKEN` and
  `PAYPAL_ENVIRONMENT=SANDBOX`.
- Remote sandbox: `https://mcp.sandbox.paypal.com/sse` or `https://mcp.sandbox.paypal.com/http`.
  The official docs do not list a `/mcp` path.
- Remote auth: browser login, or a bearer token through `npx mcp-remote <url> --header ...`.
- Known issue: Windows with Cursor can fail on remote MCP. Use the local server on Windows. If a
  remote connection fails, delete the `.mcp-auth` folder in the home directory.

## Agentic commerce

Agent Ready and Store Sync need a request form and PayPal onboarding. They are not self-serve.
Agent Ready paths: ACP (ChatGPT, through Braintree), UCP with Braintree, and UCP with PayPal
Orders v2 (Google AI Mode and Gemini). For the "Best Use of Agentic Commerce" prize, build an
agent that transacts through the toolkit or MCP in the sandbox. Describe ACP or UCP as the target
design only.

## PYUSD

PYUSD is live on Stellar mainnet since September 18, 2025 (issuer Paxos, Stellar Asset Contract).
The PayPal sandbox does not cover PYUSD. The Rules require "the PayPal developer platform (using the
free sandbox environment)". A PYUSD-only entry risks Stage One. Pair it with a sandbox REST call.
Never use the mainnet PYUSD issuer in this repo.

## AI docs for agents

- Hub: https://developer.paypal.com/ai-tools/get-started
- Index: https://developer.paypal.com/llms.txt
- Each docs page has a Markdown version: add `.md` to the URL.
- Agent tools reference: https://developer.paypal.com/ai-tools/agent-tools

## Re-check before you rely on it

1. PHP decimal places. Use 2 and confirm with one sandbox order.
2. Payouts enablement on a sandbox app, and one PHP sandbox payout.
3. Invoicing, Subscriptions and Pay Later availability for a Philippine account.
4. The PYUSD Stellar testnet issuer and faucet.
5. The exact header value for remote MCP token auth.
6. AP2 support and the Agent Ready launch dates.
