# PayPal AI Hackathon 2026: submission checklist

Do the steps in this order. A step is done only when its check passes. Run the check again. Do
not trust the status column: it records the state on 2026-11-11.

Deadline: November 12, 2026, 12:00 PST (November 13, 04:00 Manila). The last push before the
deadline is the state the judges see.

## Steps

| # | Step | Done when | Check | Status 2026-11-11 |
| --- | --- | --- | --- | --- |
| 0 | Get the owner decision to enter. The PayPal work needs a waiver of the "no features for the demo" rule, plus each `AGENTS.md` confirmation gate it touches | The owner said yes in writing | Ask the owner | Open |
| 1 | Confirm eligibility for each team member | Each member is of age and lives in an eligible place. Ask support@devpost.com if in doubt | Read `rules.md`, Eligibility | Philippines not excluded by name. Not confirmed |
| 2 | Build one PayPal sandbox flow that the AI drives or uses | A sandbox call succeeds from the running app, and the AI part takes part in it | Run the flow. See the order or payout in the sandbox dashboard | Fail: no PayPal code |
| 3 | Commit the new work with dates after October 1 | `git log --since=2026-10-01` shows the project commits | `git log --since=2026-10-01 --oneline` | Fail: no project commits since September 28 |
| 4 | Clear secrets from the tree and the history before the repo goes public | A secret scan of all history finds no real key, seed or token. Each found credential is rotated | Run a history secret scanner (for example `gitleaks detect`). Check each Stellar key on mainnet Horizon | Fail: open findings. Details are in the local, untracked `reports/` folder |
| 5 | Add an open source license file | GitHub shows the license in the About section | `gh repo view --json licenseInfo` | Fail: `licenseInfo` is null |
| 6 | Write the README for judges | The README has the problem, setup and run steps, sandbox test credentials, the AI tools and how they are used, and "What changed since October 1" | Follow the README on a clean clone | Open |
| 7 | Record the video | Less than 3 minutes, public on YouTube, shows PayPal and AI working on the target device, no unlicensed music. Every claim matches the build | Watch it once, then open the link while logged out | Open. Upload early: processing can take hours |
| 8 | Make the repo public | The repo is public, after step 4 passes | `gh repo view --json visibility` | Fail: PRIVATE |
| 9 | Fill the Devpost form | Description, "Built With" (PayPal and the AI tool), repo URL, video URL, test access and sponsor tools are all entered. Each teammate accepted the invite | Open the submission page | Open |
| 10 | Submit before the deadline | Devpost shows the project as submitted | Open the submission page | Open |
| 11 | If submitted, freeze until December 21 | No commit, README edit or video change after the deadline | `git log --since="2026-11-12 20:00 UTC"` is empty | Not started |
| 12 | Keep test access live until December 21 | The hosted demo, sandbox credentials and sponsor trials work | Open the demo URL | Not started |

## Warnings

Making the repo public is irreversible. Anyone can copy the full history in minutes. Do step 8
only after step 4 passes.

The video must match the build. The Rules require the Project to "function as depicted in the
video". Do not show a flow that the build cannot do.

Give judges sandbox credentials only. Never give a live key, a real PIN or real beneficiary data.
