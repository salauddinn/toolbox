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
