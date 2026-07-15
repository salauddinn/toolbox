const SUPPORTED_CONTRACT = [
  "Public GitHub repository that passes Safety Screening",
  "Single-root npm project with package.json",
  "JavaScript CommonJS (no type: module)",
  "Express.js and Mongoose declared dependencies",
  "Recognizable entry (app.js, server.js, or index.js)",
  "At least one route and one Mongoose model",
  "Existing CommonJS Jest/Supertest harness via npm test for transformation",
  "At most 150 analyzed source files and 2 MB analyzed source",
] as const;

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Modularize one domain safely
        </h1>
        <p className="max-w-2xl text-base text-muted sm:text-lg">
          ToolBox analyzes a supported Legacy Application, ranks technical Domain Candidates with
          code evidence, and applies three or four approved Change Sets inside the existing
          deployment boundary. It does not create microservices.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-medium">Start a Modernization Assessment</h2>
        <p className="mt-1 text-sm text-muted">
          Eligibility and Safety Screening run before any AI call.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            disabled
            className="inline-flex h-11 items-center justify-center rounded-lg bg-accent px-5 text-sm font-medium text-accent-foreground opacity-90"
            title="Available after repository loading is implemented"
          >
            Try supported example
          </button>
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row">
            <label className="sr-only" htmlFor="github-url">
              Public GitHub repository URL
            </label>
            <input
              id="github-url"
              name="github-url"
              type="url"
              disabled
              placeholder="https://github.com/owner/repo"
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted disabled:opacity-70"
            />
            <button
              type="button"
              disabled
              className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg border border-border px-5 text-sm font-medium text-foreground opacity-70"
            >
              Analyze
            </button>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">
          Placeholder start screen — repository loading and analysis land in later phases.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-medium">Supported repository contract</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted">
          {SUPPORTED_CONTRACT.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
