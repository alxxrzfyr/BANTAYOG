# Documentation

Start with the [project README](../README.md) to try BANTAYOG. Use the references below for
development and operations. Completed instructions and old snapshots live in the
[archive](archive/README.md); they are not current implementation tasks.

## Current references

| Guide | Use it for |
| --- | --- |
| [Architecture](context/ARCHITECTURE.md) | Application boundaries and current data flows. |
| [Product requirements](context/PRD.md) | Product scope and the distinction between built and planned features. |
| [Database schema](context/SCHEMA.md) | Migrations, database functions, and known type drift. |
| [Coding rules](context/RULES.md) | Implementation patterns and approval gates. |
| [Design system](context/DESIGN.md) | Shared visual tokens and UI behavior. |
| [Admin design reference](ADMIN_UI_DESIGN_SYSTEM.md) | Existing administrator page patterns. |
| [Security policy](SECURITY.md) | Access boundaries, private requests, and payment safety. |
| [Server setup](../apps/server/README.md) | Configuration and API setup. |
| [Stellar testnet operations](stellar-testnet.md) | Bootstrap and re-provisioning commands. |

## Payment contracts

The [settlement contract](designs/paypal-settlement.md) and [fund contract](designs/paypal-fund.md)
remain active references even though their implementations exist. They define payment behavior,
review boundaries, and recovery rules. Decisions and trade-offs remain in [the ADR directory](adr/).

## Planned work

The [Rural offline ADR](adr/004-rural-offline-quota-authorization.md),
[design](superpowers/specs/2026-08-04-offline-product-validation-and-transactions-design.md),
[implementation plan](superpowers/plans/2026-08-04-rural-offline-merchant-flow.md), and
[open review findings](handoff/reviews/) are not completed work. Keep their approval gates and
acceptance conditions. The [merchant APK handoff](handoff/MERCHANT_APK_HANDOFF.md) also contains
unfinished packaging tasks; its retired wallet instructions must not be reused.

## Event records

Keep showcase facts in [the showcase guide](SHOWCASE.md). PayPal event rules, setup, and
verification remain in [the hackathon folder](paypal-hackathon/).
