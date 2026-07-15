# ToolBox

Evidence-backed Express.js domain modularization for supported Legacy Applications.

ToolBox analyzes a Supported Repository, ranks technical Domain Candidates with code evidence, and modularizes the developer-selected candidate through three or four approved Change Sets. It does not create microservices.

## Requirements

- Node.js 20+
- npm

## Setup

```bash
npm install
cp .env.example .env
# Fill AI_BASE_URL, AI_API_KEY, AI_MODEL (server-only)
# Optional: GITHUB_TOKEN for public-repository rate capacity
```

Never prefix secrets with `NEXT_PUBLIC_`. API keys must remain server-side.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Long-lived local development server |
| `npm run build` | Production build |
| `npm start` | Start production server (single process) |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript |
| `npm run format` / `format:check` | Prettier |
| `npm test` | Unit tests (Vitest) |
| `npm run verify` | format + lint + typecheck + test + build |

## Health

`GET /api/health` reports process liveness. Active runs are in-memory only; process restart discards them.

## Supported repository contract

See the product plan in `rough.md` and terminology in `CONTEXT.md`.

Paste any public root `https://github.com/<owner>/<repo>` URL at runtime. External repositories are loaded for static analysis only — ToolBox does not install or execute them.

### Demo / verification repositories

These repositories are not hard-coded in product logic: paste a root GitHub URL into the UI or loader at runtime. ToolBox must re-run Eligibility, Safety Screening and Transformation Readiness on every fetch. External code is analyzed statically only; ToolBox never installs or executes it.

Use the following order during development and the demo:

1. **Bundled four-stage success path:** `fixtures/controlled-example`
   - Primary demo source because it is controlled, tests are safe to run locally, and it deliberately preserves the Orders↔Payments cycle.

2. **External three-stage static transformation:** [JAlexShulha/test-driven-development-unit-integration](https://github.com/JAlexShulha/test-driven-development-unit-integration)
   - Public single-root CommonJS Express/Mongoose repository.
   - One Todo model; direct literal routes; route-reachable CRUD writes; Jest and Supertest.
   - Use only as a static-analysis example. It has no committed lockfile, expects a remote MongoDB credential for integration tests, and a temporary dependency audit reports an old Mongoose critical advisory. Do not install or execute it.

3. **Transformation Readiness rejection:** [edignot/node-express-mongoDB-mongoose-jest-supertest-nock](https://github.com/edignot/node-express-mongoDB-mongoose-jest-supertest-nock)
   - Public CommonJS Express/Mongoose repository with one Quote model and Jest/Supertest.
   - Its routes use chained `router.route()` registration, which is outside ToolBox's current direct literal `router.get/post/...` transformation profile. Show the assessment and the exact readiness blocker; make no generation call.

4. **Transformation Readiness rejection:** [tsmx/nodejs-tutorial](https://github.com/tsmx/nodejs-tutorial)
   - Public CommonJS Express/Mongoose repository with current test tooling and `mongodb-memory-server`.
   - Its route-wrapper factory (`routes(app)`) and read-only MasterData candidate are outside the bounded generation contract. Show an evidence-backed no-ready-candidate result.

5. **Eligibility / Safety Screening rejection:** [Anouar-Dhahri/testing-rest-api-nodejs-mongo](https://github.com/Anouar-Dhahri/testing-rest-api-nodejs-mongo)
   - Tracked private-key material and ESM configuration.
   - ToolBox must reject before analysis or AI usage and show both reason codes.
