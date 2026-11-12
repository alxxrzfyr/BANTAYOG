# PayPal AI Hackathon 2026: rules

Verified on 2026-11-11. Source: the Official Rules (https://paypalaihackathon.devpost.com/rules),
the FAQ (`/details/faqs`) and the official updates (`/updates`). Section numbers (§) refer to the
Rules. Quotes are verbatim.

## Eligibility (§3)

- Entrants: "Individuals who are at least the age of majority where they reside as of the time of
  entry", teams of such individuals, and organizations that exist at the time of entry.
- Excluded places: residents of a place "where the laws of the United States or local law
  prohibits participating or receiving a prize in the Hackathon (including, but not limited to,
  Brazil, Quebec, Russia, Crimea, Cuba, Iran, and North Korea and any other country which is
  comprehensively sanctioned by the U.S. Treasury's Office of Foreign Assets Control)".
- The Philippines is not on the list. The list is open-ended. No primary source confirms
  Philippine eligibility. To get certainty, ask support@devpost.com and keep the written answer
  (§11.6).
- Excluded persons include PayPal, Devpost, their staff and families, and "Any Judge (defined
  below), or company or individual that employs a Judge". Judges come from PayPal and seven sponsor
  companies (AG Grid, APIMatic, Bryntum, Channel3, Elastic, Postman, Render).
- Teams: no maximum size. Appoint one Representative to submit. Each teammate must register on
  Devpost and accept the project invite. The FAQ says: "This applies to every member of a team."

## New and existing projects (§4)

> "Projects must be either newly created by the Entrant or, if the Entrant's Project existed prior
> to the Hackathon Submission Period, must have been significantly updated after the start of the
> Hackathon Submission Period. Entrants should explain how their Project was significantly updated
> during the Submission Period."

The Sponsor and Devpost decide what is "significant". No proof format is defined. Use dated
commits after October 1 and a "What changed since October 1" section in the README and the
description.

A Project "must not have been developed, or derived from a Project developed, with financial or
preferential support from the Sponsor or Administrator". The Rules have no exclusivity clause.
Entry in another event (for example WOCEE) does not block entry.

## Deliverables (§4)

| Item | Requirement (verbatim where it decides validity) |
| --- | --- |
| Build | "integrates the PayPal developer platform (using the free sandbox environment) along with an AI tool, model, or platform of their choice" |
| PayPal scope | "all the services provided by PayPal such as Venmo, Braintree, Xoom, Honey, Zettle, Paidy, Hyperwallet ..." |
| Function | "must function as depicted in the video and/or expressed in the text description" |
| Description | "explain the features and functionality of your Project". Name PayPal and the AI tool in the description, in "Built With" and in the video (Update 47305) |
| Tools list | "identify which tools (model or AI service) were used and explain how the tools were used" |
| Demo | "judges must be able to actually run or interact with a working build": setup and run steps in the repo OR a hosted URL. "A design mockup, static prototype, or non-functional demo does not meet this requirement." |
| Repo | Public on GitHub, Bitbucket or GitLab, with "all necessary source code, assets, and instructions". "This license should be detectable and visible at the top of the repository page (in the About section)." Any detected open source license works |
| Video | "less than three (3) minutes", public on YouTube, shows "the Project functioning on the device for which it was built", no unlicensed music or third-party trademarks |
| Test access | Free and unrestricted access for judges. Put "any test account credentials, API keys, or sandbox login details necessary to run and test the Project" in the README or description |
| Language | English, or an English translation of every item |
| Sponsor prizes | Select the sponsor tools on the submission form |

Devpost also says: "Hide your API keys. Use environment variables, never commit secrets." Give
judges sandbox credentials only. Never give a real secret.

## Judging (§6)

Judges may use "expert panels, peer review, automated AI-driven analysis, or any combination".
"Judges are not required to test the Project and may choose to judge based solely on the text
description, images, and video provided in the Submission." The video carries much of the score.

**Stage One (pass/fail).** The Rules check that "the Project reasonably fits the theme and
reasonably applies the required APIs/SDKs". Update 47306 adds "a working build, a public repo with
an open source license, a public video under 3 minutes, and meaningful use of PayPal and AI".
Meet both lists.

**Stage Two.** Five "equally weighted" criteria. Update 47306 says judges score each from 1 to 5.

| Criterion | Rules text |
| --- | --- |
| Technological Implementation | "How thoroughly and skillfully does the project use PayPal Developer Platform and AI tool(s)? Does the project reflect genuine effort and a working, non-trivial implementation?" |
| Design | "Does the project deliver a complete, coherent product experience — not just a technical proof of concept?" |
| Potential Impact | "Does the project make a credible, specific case for solving a real problem for a real audience — and does the solution actually address that problem based on what's demonstrated?" |
| Innovation/Idea | "How creative and novel is the concept and does the project differ from existing concepts?" |
| Presentation | "Does the video clearly demonstrate the project working end-to-end? Does the pitch communicate what problem is solved, who it's for, and why it matters? Is the overall presentation easy to follow?" |

Ties go to the higher score in the first criterion in this order.

## Prizes (§8)

| Prize | Amount |
| --- | --- |
| Grand Prizes | 1st $12,000; 2nd $8,000; 3rd $5,000 |
| Honorable Mentions | $5,000 each: Most Creative, Most Impactful, Best Demo Delivery, Best Use of PayPal + AI, Best Use of Agentic Commerce |
| Sponsor Prizes | See `sponsors.md` |

> "A project can only win up to one (1) Grand Prize and one (1) Sponsor Prize OR one (1)
> Honorable Mention Prize and one (1) Sponsor Prize."

No primary source defines how each honorable mention is judged. Winners return affidavits and a
W-9 or W-8BEN within 10 business days. Payment comes within 60 days. Winners pay their own taxes.

## IP and publicity (§4, §7)

- The work must be original and solely owned by the entrant. Open source parts are allowed if the
  entry "enhances and builds upon" them and obeys their licenses.
- "All Submissions remain the intellectual property of the individuals or organizations that
  developed them." The Sponsor gets a non-exclusive license to use the entry for judging.
- PayPal and Devpost may publicize the entry and the names and images of contributors for three
  years.

## Post-deadline freeze (§5)

The Rules lock the Submission at the deadline. The official updates are stricter:

> "After the deadline, don't touch anything: no commits, no README edits, no swapping your video.
> Leave everything as-is until the winner announcement." (Update 47308)

If BANTAYOG was submitted, make no repo, README or video change from November 12, 12:00 PT until
December 21. This includes changes to this folder. If BANTAYOG was not submitted, the freeze does
not apply.

## Conflicts and controlling values

| Item | Conflict | Use |
| --- | --- | --- |
| Winner time | Rules: Dec 21, 14:00 PT. Dates page: 12:00 EST | Rules: 14:00 PT |
| Test access end | Rules: end of judging (Dec 15). Update 47307: Dec 21 | Dec 21 |
| Freeze | Rules allow Devpost portfolio edits. Updates forbid all edits | No edits until Dec 21 |
| Stage One | Rules: theme and API use. Update: build, license, video, PayPal and AI | Meet both |
| Prize total | PayPal blog: "$60,000+". Rules and Devpost: $67,500 cash | $67,500 cash |
| Existing project | Rules: "significantly updated". Overview: "meaningful progress" | Rules |
