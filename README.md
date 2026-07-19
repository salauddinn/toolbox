# ToolBox

Turn one tangled Express domain into an accepted module without rewriting the application.

ToolBox analyzes a Supported Repository, ranks technical Domain Candidates using clickable code evidence, and advances the developer-selected candidate through three or four bounded Change Sets. AI generates changes only after authorization; deterministic validation checks every proposal before the developer accepts it.

ToolBox keeps the application inside its existing deployment boundary. It does not create microservices or claim to automate a production migration.

## Hackathon

Built for the OpenAI x NamasteDev Codex Hackathon, 15-19 July 2026.

The project demonstrates an evidence-first use of AI for a high-risk engineering workflow. AI is not trusted to decide repository eligibility, invent architectural facts, waive blockers, or apply its own output. It generates code inside a deterministic Stage Plan, receives structured validation errors for at most one repair attempt, and remains subject to explicit developer acceptance.

## Why it matters

Legacy Application modernization often begins with an unsafe question: "What should we rewrite or extract first?" Generic code-generation tools can propose broad changes without proving that they preserve routes, schemas, ownership boundaries, or dependency direction.

ToolBox narrows that problem:

1. Find technically coherent Domain Candidates from static evidence.
2. Show why a candidate is or is not ready for transformation.
3. Let the developer confirm one Modernization Decision.
4. Generate one bounded Change Set at a time.
5. Validate and review every change before it enters the current snapshot.

## Demo workflow

1. Open the work console and run the controlled example, or enter a public GitHub root URL.
2. Review eligibility, Safety Screening, routes, models, dependency cycles, and ranked Domain Candidates.
3. Click evidence to trace claims to exact files, lines, and snippets.
4. Confirm a ready Domain Candidate and inspect its Stage Plans.
5. Authorize AI generation for the current stage.
6. Review the candidate-snapshot diff and Validation Report.
7. Accept or reject the Change Set.
8. Download the accepted repository snapshot and final Validation Report as a ZIP.

## AI and deterministic responsibilities

| Concern | Responsible component |
| --- | --- |
| Repository eligibility and Safety Screening | Deterministic rules |
| Express routes, Mongoose models, writes, imports, and cycles | Babel-based static analysis |
| Domain Candidate ranking and Transformation Readiness | Deterministic evidence rules |
| Stage count, purpose, path envelope, and validation contract | Deterministic sequence planner |
| Proposed source changes and one bounded repair attempt | Configured AI provider |
| Syntax, path, scope, route, schema, dependency, and fingerprint checks | Deterministic static validation |
| Promotion of a validated candidate snapshot | Explicit developer Change Acceptance |

## Architecture

```text
Public GitHub repository or controlled example
  -> in-memory source snapshot
  -> eligibility and Safety Screening
  -> Express/Mongoose static analysis
  -> evidence-backed Domain Candidate ranking
  -> developer selection
  -> deterministic Stage Plan
  -> authorized AI generation
  -> candidate snapshot and Static Validation
  -> developer acceptance
  -> accepted snapshot plus Validation Report ZIP
```

The Next.js application runs as one long-lived Node.js process. Active runs, snapshots, and generated Change Sets are intentionally kept in memory and expire after 30 minutes. A process restart discards active runs.

## Safety boundaries

- Public GitHub repositories only; no user-supplied GitHub tokens.
- External repositories are analyzed statically and are never installed or executed.
- Safety Screening and eligibility finish before repository content can reach the AI provider.
- Repository text is delimited as untrusted data and never treated as model instructions.
- The AI provider receives no tools, shell, network, or environment access.
- Stage-specific path envelopes and byte/operation budgets constrain every response.
- Manifests, lockfiles, licenses, `.github`, environment files, and ignored content are protected.
- A failed Change Set receives one bounded repair attempt; a second failure rolls back and stops the sequence.
- Passing Safety Screening is not malware certification.
- Static Validation records only the checks actually performed and is not Runtime Validation.

## Supported Repository contract

Assessment currently requires:

- A public root `https://github.com/<owner>/<repo>` URL
- One npm application root
- JavaScript CommonJS
- Express.js and Mongoose dependencies
- A recognized `app.js`, `server.js`, or `index.js` entry point
- At least one recognizable Express route and Mongoose model
- No more than 150 analyzed files or 2 MB of analyzed source

Transformation additionally requires a ready Domain Candidate and an existing CommonJS Jest/Supertest harness available through `npm test`. Support means a repository can enter assessment; it does not mean every domain can enter generation.

## Demo and verification repositories

These URLs are runtime inputs, not hard-coded product outcomes. ToolBox reruns eligibility, Safety Screening, analysis, ranking, and readiness for every fetch.

1. **Controlled four-stage success path:** `fixtures/controlled-example`
   The primary demo deliberately contains Orders, Payments, Users, and an Orders/Payments cycle.

2. **External three-stage static transformation:** [JAlexShulha/test-driven-development-unit-integration](https://github.com/JAlexShulha/test-driven-development-unit-integration)
   Use as a static-analysis example only. It expects remote MongoDB configuration and has no committed lockfile, so ToolBox does not execute it.

3. **Transformation Readiness rejection:** [edignot/node-express-mongoDB-mongoose-jest-supertest-nock](https://github.com/edignot/node-express-mongoDB-mongoose-jest-supertest-nock)
   Its chained `router.route()` registration is outside the current transformation profile.

4. **Assessment-only result:** [tsmx/nodejs-tutorial](https://github.com/tsmx/nodejs-tutorial)
   Its route-wrapper factory and read-only candidate remain outside the bounded generation contract.

5. **Eligibility and Safety Screening rejection:** [Anouar-Dhahri/testing-rest-api-nodejs-mongo](https://github.com/Anouar-Dhahri/testing-rest-api-nodejs-mongo)
   Recognized private-key material and ESM configuration stop the workflow before analysis or AI usage.

## Requirements

- Node.js 24.11+
- npm
- A long-lived single-process Node host for deployment

## Setup

```bash
npm install
cp .env.example .env.local
# Fill AI_BASE_URL, AI_API_KEY, and AI_MODEL for normal AI generation.
# Optional AI_INPUT_TOKEN_BUDGET (65536 default; 1000000 maximum) and
# AI_OUTPUT_TOKEN_BUDGET (32768 default; 131072 maximum) are server-side provider request budgets.
# They use deterministic UTF-8 byte estimates plus a chat framing safety reserve, not exact tokenizer counts.
# The 32768 output budget is a stricter outer gate than Stage Plan operation/byte ceilings,
# so a Stage Plan with larger byte ceilings can be unreachable in one provider response.
# Optional AI_REQUEST_TIMEOUT_MS (180000 default; 10000–600000) is the single provider HTTP timeout.
# GITHUB_TOKEN is optional and used only for public-repository rate capacity.
npm run dev
```

Never prefix secrets with `NEXT_PUBLIC_`. API keys remain server-side.

### Generation modes (both supported)

| Mode | How | Use when |
| --- | --- | --- |
| **Normal AI** (default) | Leave `TOOLBOX_DETERMINISTIC_GENERATION` unset/`0`. Set `AI_*`. | Live authorize/generate with your provider |
| **Toolbox deterministic** | `TOOLBOX_DETERMINISTIC_GENERATION=1` | Offline demos, fixtures, or when you want no live model call |

Run one mode per process. For slow providers, raise `AI_REQUEST_TIMEOUT_MS` (for example `300000`) instead of switching modes.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run build` | Create the production build |
| `npm start` | Start one long-lived production process |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript checks |
| `npm run format` / `npm run format:check` | Write or check Prettier formatting |
| `npm test` | Run the Vitest suite |
| `npm run verify` | Run formatting, lint, typecheck, tests, and build |

`GET /api/health` reports process liveness.

## Deployment

ToolBox requires one long-lived Node.js process because active runs are held in memory. Deploy one container instance and do not enable horizontal scaling for the hackathon MVP.

```bash
docker build -t toolbox .
docker run --env-file .env.local -p 3000:3000 toolbox
```

Configure `AI_BASE_URL`, `AI_API_KEY`, and `AI_MODEL` as server-side host secrets. Leave `TOOLBOX_DETERMINISTIC_GENERATION` unset so authorized stages use the configured AI provider. Set the health-check path to `/api/health` and keep the service available through the judging period.

After deployment, verify the landing page, controlled example, AI generation, Change Acceptance, and ZIP download in an incognito browser. A process restart intentionally discards active runs.

### Render

`render.yaml` defines one Docker web service and configures `/api/health` as its health check. Create a Render Blueprint from the public repository, enter the three AI environment values when prompted, and deploy one instance.

The Blueprint uses Render's free plan to avoid creating a paid resource automatically. Free services can sleep and introduce a cold start; switch to an always-on plan in the Render dashboard only if you choose to incur that cost for the judging period.

## Current limitations

- The syntax contract is intentionally narrow: JavaScript CommonJS Express/Mongoose applications using supported direct route, mount, handler, model, and CRUD shapes.
- Candidate ranking is technical evidence, not business priority.
- The hosted application does not execute external repositories or claim runtime verification for them.
- Integration cleanup and deletion remain conservative and may stop rather than guess when references cannot be proven safe.
- Run state is in-memory, single-process, and non-durable.
- ToolBox modularizes one domain inside the existing application; it does not split databases or deployments.

Product terminology and boundaries are documented in `CONTEXT.md`. Architecture decisions are recorded in `docs/adr/`.
