# ToolBox — 3-minute demo script

For the OpenAI × NamasteDev Codex Hackathon. Target: **≤ 3:00**.  
Record against the **public deployed URL** in an incognito window. Prefer the **controlled example** path.

## One-line pitch (say this first)

> ToolBox finds a domain you can modularize safely, proves it with code evidence, then lets AI change only what you authorize.

## Prep (before record)

1. Deploy is warm (`GET /api/health` → ok).
2. AI keys set; `TOOLBOX_DETERMINISTIC_GENERATION=0` for live generation (or `1` if provider is slow — say so once).
3. Incognito browser; no leftover cookies.
4. Screen resolution large enough to show evidence inspector + diff.
5. Optional: one practice run so the first authorize is not cold.

## Timed narration

| Time | Screen | Say | Do |
| --- | --- | --- | --- |
| **0:00–0:20** | Landing `/` | “Modernization usually starts with an unsafe question: what should we rewrite first? Generic AI will invent a big change without proving boundaries.” | Scroll hero; point at **first safe cut** chip and judge callout. |
| **0:20–0:35** | Landing → `/app` | “ToolBox keeps AI inside a deterministic workflow. Facts come from static analysis. AI only writes after I authorize a Stage Plan. I accept every change.” | Click **Open work console**. |
| **0:35–0:50** | Start | “For the reliable path I use the controlled example—Orders, Payments, Users, and a known cycle. No random GitHub roulette.” | Click **Try controlled example**. Wait for assessed. |
| **0:50–1:20** | Choose | “Assessment ranked Domain Candidates from code evidence, not business priority. Orders is ready. I can open evidence and jump to the exact file and line.” | Select **Orders** (or top ready candidate). Open one evidence item; show snippet; close. Confirm Modernization Decision. |
| **1:20–1:50** | Authorize | “Here is the Stage Plan: purpose, path envelope, validation contract. AI has not run yet. I authorize this stage only.” | Show Stage Plan fields. Click authorize / generate. Wait for validation. |
| **1:50–2:25** | Review | “Static Validation checked the proposal. This is not runtime proof. I review the diff, then perform Change Acceptance. AI cannot self-apply.” | Scroll diff + validation summary. **Accept**. |
| **2:25–2:50** | Done (or next stage) | “I can continue the sequence the same way, or stop with an accepted snapshot. Result is a downloadable ZIP: repository plus Validation Report.” | If time: accept one more stage quickly, or jump to completion/ZIP if already available. Click download if ready. |
| **2:50–3:00** | Landing or Done | “Same deploy boundary—no fake microservice migration. Evidence first, AI second, human last.” | End on ZIP or completion panel. |

## If time is tight (cut order)

1. Skip second/third stage — one authorize + one accept is enough.
2. Skip long evidence tour — one clickable evidence is enough.
3. Do **not** skip: controlled example, ranked candidate, authorize-before-AI, accept, ZIP or completion state.

## If something fails live

| Failure | Recovery line | Action |
| --- | --- | --- |
| Cold start / slow host | “Host was sleeping; health is back.” | Wait for `/api/health`; restart fixture. |
| AI timeout | “Provider latency hit the budget; ToolBox can use bounded deterministic generation for the same Stage Plan contract.” | Retry once, or show prior successful Validation Report/ZIP from practice if policy allows. Prefer not to fake. |
| Eligibility/safety on GitHub URL | “Unsupported repos stop before AI—by design.” | Switch to controlled example. |
| Run lost after refresh | “Runs are in-memory and expire; I start a fresh assessment.” | New controlled example. |

## What judges should take away

1. **Originality** — not chat-with-repo; trust boundary is the product.
2. **Impact** — safer first modularization step inside a real Express app.
3. **AI fluency** — AI generates only inside an authorized Stage Plan; deterministic ranking and validation.
4. **Prototype** — working path to accepted Change Set + artifact.
5. **Demo** — clear 3-minute arc.
6. **Creativity** — “first safe cut” / evidence-before-generation framing.

## Submission checklist (non-code)

- [ ] Public app URL works in incognito
- [ ] Public GitHub repo link
- [ ] Demo video ≤ 3:00, unlisted/public, no login wall
- [ ] Video shows controlled example happy path
- [ ] README mentions deploy URL (when live)
- [ ] Optional: 4–5 slide deck (does not replace video)

## Out of scope for the recording

- Random popular GitHub apps (many will honestly fail eligibility/safety)
- Claiming runtime test execution on external repos
- Claiming microservice extraction or production migration
- Deep ADR tour (point to repo if asked)

## Suggested video title / description

**Title:** ToolBox — first safe domain modularization with evidence-gated AI  

**Description:**

```text
ToolBox (OpenAI × NamasteDev Codex Hackathon)

Find a domain you can modularize safely. Prove it with code evidence.
Let AI change only what you authorize.

Demo path: controlled example → Orders → authorize Stage Plan →
accept Change Set → download ZIP.

App: <PUBLIC_URL>
Repo: https://github.com/salauddinn/toolbox
```
