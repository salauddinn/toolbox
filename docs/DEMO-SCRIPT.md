# ToolBox — 3-minute demo script

For the OpenAI × NamasteDev Codex Hackathon. Target: **≤ 3:00**.  
Record against the **public deployed URL** in an incognito window. Prefer the **controlled example** path.

## One-line pitch (say this first)

> ToolBox finds a domain you can modularize safely, proves it with code evidence, then lets AI change only what you authorize.

## Distinction line (use once in the first 20s or last 10s)

> Anyone can ask an agent to turn a monolith into microservices. ToolBox does the harder, safer thing: it finds the first domain you can modularize with proof, locks AI inside that Stage Plan, validates the proposal, and only applies what you accept — without pretending it finished a microservice migration.

## How this differs from “just ask an agent”

Use this if a judge asks, or compress one sentence into the video.

| | Normal agent chat | ToolBox |
| --- | --- | --- |
| Goal | Often full monolith → microservices | One Domain Module inside the **same deploy** |
| Who decides “what first?” | Model (or vague human prompt) | Deterministic ranking + clickable code evidence; human confirms |
| Facts | Model may invent deps/routes | Static analysis builds routes, models, cycles |
| AI role | Plan + edit broadly | Generates only inside an authorized Stage Plan |
| Apply changes | Often writes straight to the tree | AI cannot self-apply; Change Acceptance is separate |
| Failure | Half-migrated mess | One repair, then rollback; keep last accepted snapshot |
| Claim | “We split the system” | “We modularized one domain safely” — not a production microservice migration |

**Normal flow:** ask → agent guesses architecture → large edits → you debug.  
**ToolBox flow:** assess → evidence → you decide → Stage Plan → authorize → validate → you accept → ZIP.

## Prep (before record)

1. Deploy is warm (`GET /api/health` → ok).
2. AI keys set; `TOOLBOX_DETERMINISTIC_GENERATION=0` for live generation (or `1` if provider is slow — say so once).
3. Incognito browser; no leftover cookies.
4. Screen resolution large enough to show evidence inspector + diff.
5. Optional: one practice run so the first authorize is not cold.

## Timed narration

| Time | Screen | Say | Do |
| --- | --- | --- | --- |
| **0:00–0:25** | Landing `/` | “Anyone can ask an agent to turn a monolith into microservices. That’s unsafe when you don’t know the first cut. ToolBox finds a domain you can modularize safely, proves it with code evidence, then lets AI change only what you authorize — still one deploy, not a fake service split.” | Scroll hero; point at **first safe cut** chip and sample assessment card. |
| **0:25–0:40** | Landing → `/app` | “Facts come from static analysis. AI only writes after I authorize a Stage Plan. I accept every change. Authorize and accept are separate.” | Click **Open work console**. |
| **0:40–0:55** | Start | “Reliable path: controlled example—Orders, Payments, Users, and a known cycle. No random GitHub roulette.” | Click **Try controlled example**. Wait for assessed. |
| **0:55–1:25** | Choose | “Candidates are ranked from code evidence, not business priority. Orders is ready. Evidence opens the exact file and line — an agent chat usually just asserts this.” | Select **Orders** (or top ready). Open one evidence item; show snippet; close. Confirm Modernization Decision. |
| **1:25–1:55** | Authorize | “Stage Plan is fixed: purpose, path envelope, validation. AI has not run yet. I authorize this stage only — watch the progress while generation and Static Validation run.” | Show Stage Plan. Click authorize. Show progress panel (spinner / steps / elapsed). Wait for review. |
| **1:55–2:30** | Review | “Static Validation checked the proposal — not runtime proof. I review the diff, then Change Acceptance. AI cannot self-apply the way a coding agent often does.” | Scroll diff + validation. **Accept**. |
| **2:30–2:50** | Done (or next stage) | “Continue the same way, or stop with accepted work kept. ZIP = accepted snapshot + Validation Report.” | Optional second stage or download ZIP. |
| **2:50–3:00** | Done | “Evidence first, AI second, human last. Same deploy boundary — modularize safely before you ever split services.” | End on ZIP / completion. |

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

1. **Originality** — not “ask agent to microservice the monolith”; trust boundary is the product.
2. **Impact** — safer first modularization step inside a real Express app.
3. **AI fluency** — AI generates only inside an authorized Stage Plan; deterministic ranking and validation.
4. **Prototype** — working path to accepted Change Set + artifact (with visible authorize progress).
5. **Demo** — clear 3-minute arc + crisp distinction from generic coding agents.
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

Not “chat agent → microservices.” Evidence-ranked first cut, authorized
Stage Plan, Static Validation, human Change Acceptance — same deploy boundary.

Demo path: controlled example → Orders → authorize Stage Plan →
accept Change Set → download ZIP.

App: <PUBLIC_URL>
Repo: https://github.com/salauddinn/toolbox
```
