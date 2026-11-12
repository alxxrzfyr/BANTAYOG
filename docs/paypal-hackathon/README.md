# PayPal AI Hackathon 2026

Verified on 2026-11-11 against the primary pages. This folder is event context. Archive it after
the winner announcement on December 21, 2026. When you archive it, also remove the pointers in
`AGENTS.md`, `.kiro/steering/product.md` and `.kiro/steering/structure.md`.

This folder is the single source of truth for the hackathon. Do not copy its facts into other
files. Link to this folder instead. The WOCEE showcase facts stay in `docs/SHOWCASE.md`.

## Event facts

| Item | Value |
| --- | --- |
| Event | PayPal AI Hackathon, "Build What's Next with PayPal and AI" |
| Sponsor / Administrator | PayPal Inc. / Devpost, Inc. |
| Website | https://paypalaihackathon.devpost.com/ |
| Official Rules | https://paypalaihackathon.devpost.com/rules |
| Format | Online, global, free. Solo, team or organization. No team size limit |
| Submissions open | October 1, 2026, 09:15 PT |
| **Submissions close** | **November 12, 2026, 12:00 PST = 20:00 UTC = November 13, 04:00 Manila** |
| Judging | December 1, 14:00 PT to December 15, 08:00 PT |
| Winners | On or around December 21, 2026, 14:00 PT (December 22, 06:00 Manila) |
| Prize pool | $67,500 cash plus $2,250 Render credits ($69,750 total) |
| Support | PayPal Discord https://discord.gg/sJ2G6DyvSK. Rules questions: support@devpost.com |

## Theme

> "There are no prescribed problem statements and no set of tracks. Build an agent, an app, an
> automation, a new payment experience, a business tool, a social product, or something we
> haven't thought of yet."
>
> "The only fundamental requirement: your project must meaningfully use both PayPal and AI."

The Rules say: "Any AI tool works, as long as PayPal integration is central to the project."

## The Stage One gate

Judges first do a pass/fail check. An entry that fails one item gets no score. The entry must
have all of these items:

1. A meaningful PayPal integration that uses the free PayPal sandbox.
2. A meaningful AI component (any model, tool or platform).
3. A working build. Judges run it from the repo setup steps or a hosted URL.
4. A public GitHub, GitLab or Bitbucket repo with an open source license in the About section.
5. A public YouTube video, less than 3 minutes long.

An existing project must also show significant work after October 1, 2026.

## Rules control

The Official Rules control when a page disagrees with them (Rules §11.4). The files in this
folder quote the Rules and record each conflict with its controlling value.

## BANTAYOG and this hackathon

The owner authorized the PayPal build on `feat/paypal-hackathon`. It adds AI review of store
claims, sandbox invoicing, public sandbox contributions and an admin fund ledger. Live local
checks are recorded in [verification.md](verification.md). This does not mean that the new
code is deployed or that the entry is submitted.

All `AGENTS.md` confirmation gates stay in force: `settle_sale`, auth, RBAC, RLS and migrations.

## Files

| File | Read it when you |
| --- | --- |
| `rules.md` | Check eligibility, deliverables, judging, prizes, IP or the post-deadline freeze |
| `sponsors.md` | Target a sponsor prize or use a sponsor perk |
| `paypal-platform.md` | Write or review PayPal or AI integration code |
| `submission-checklist.md` | Prepare, check or send the submission |
