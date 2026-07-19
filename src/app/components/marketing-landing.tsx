import Link from "next/link";

const WORKFLOW = [
  {
    step: "01",
    title: "Assess",
    body: "Load a Supported Repository or the controlled example. Deterministic eligibility, Safety Screening, and static analysis produce ranked Domain Candidates with evidence.",
  },
  {
    step: "02",
    title: "Select candidate",
    body: "Compare readiness and blocking evidence, then confirm one ready Domain Candidate as the Modernization Decision. Ranking reflects code evidence, not business priority.",
  },
  {
    step: "03",
    title: "Authorize Stage Plan",
    body: "Inspect purpose, path envelope, and validation contract, then authorize. AI does not run until you authorize that stage.",
  },
  {
    step: "04",
    title: "Validate Change Set",
    body: "Static Validation checks repository artifacts only. It is not Runtime Validation and does not execute the application.",
  },
  {
    step: "05",
    title: "Accept changes",
    body: "Review the diff and Validation Report, then perform Change Acceptance. Only accepted Change Sets enter the snapshot and result ZIP.",
  },
] as const;

const RESPONSIBILITY = [
  {
    concern: "Eligibility and Safety Screening",
    owner: "Deterministic",
    detail: "Rules finish before analysis content can reach the AI provider.",
  },
  {
    concern: "Routes, models, writes, imports, cycles",
    owner: "Deterministic",
    detail: "Babel-based static analysis builds the evidence graph.",
  },
  {
    concern: "Domain Candidate ranking and readiness",
    owner: "Deterministic",
    detail: "Transformation Readiness is computed without AI.",
  },
  {
    concern: "Stage count, purpose, path envelope, checks",
    owner: "Deterministic",
    detail: "The sequence planner defines each Stage Plan contract.",
  },
  {
    concern: "Proposed source edits and one repair attempt",
    owner: "AI",
    detail: "Generation stays inside the authorized Stage Plan only.",
  },
  {
    concern: "Syntax, path, scope, route, schema, fingerprints",
    owner: "Deterministic",
    detail: "Static Validation records only checks actually run.",
  },
  {
    concern: "Promotion into the accepted snapshot",
    owner: "Developer",
    detail: "Explicit Change Acceptance is required; AI cannot self-apply.",
  },
] as const;

const ASSESSMENT_REQUIREMENTS = [
  "Public GitHub root URL, or the controlled bundled example",
  "Single-root npm application",
  "JavaScript CommonJS module system",
  "Express.js and Mongoose dependencies",
  "Recognized entry: app.js, server.js, or index.js",
  "At least one Express route and one Mongoose model",
  "At most 150 analyzed files and 2 MB of analyzed source",
] as const;

const TRANSFORMATION_REQUIREMENTS = [
  "At least one Domain Candidate marked ready for transformation",
  "CommonJS Jest/Supertest harness available via npm test",
  "Developer confirmation of the Modernization Decision",
  "Per-stage Stage Plan authorization before any generation call",
  "Passing Static Validation before Change Acceptance is offered",
] as const;

const BOUNDARIES = [
  {
    title: "Static Validation is not Runtime Validation",
    body: "External repositories are never installed or executed. Validation Reports list only the checks ToolBox actually ran.",
  },
  {
    title: "Safety Screening is not certification",
    body: "Passing risk gates means supported signals were not detected. It does not certify that a repository is safe or malware-free.",
  },
  {
    title: "No microservices or deploy splits",
    body: "A Domain Module stays inside the existing deployment boundary. ToolBox does not create services or claim a production migration.",
  },
  {
    title: "Developer authorizes and accepts",
    body: "You authorize every Stage Plan and accept every validated Change Set. AI output is never applied without explicit Change Acceptance.",
  },
  {
    title: "One repair, then stop",
    body: "A failed Change Set may receive one bounded repair. A second Static Validation failure rolls back and keeps the last accepted snapshot.",
  },
] as const;

const SAMPLE_CANDIDATES = [
  {
    rank: "01",
    name: "Orders",
    score: "0.86",
    state: "ready" as const,
    detail: "Exclusive write ownership · 4 routes · Order",
  },
  {
    rank: "02",
    name: "Payments",
    score: "0.71",
    state: "ready" as const,
    detail: "Cycle with Orders · 3 routes · Payment",
  },
  {
    rank: "03",
    name: "Users",
    score: "0.54",
    state: "blocked" as const,
    detail: "Shared writes · readiness fails",
  },
] as const;

export function MarketingLanding() {
  return (
    <div className="space-y-10 pb-6 sm:space-y-12">
      <section
        aria-labelledby="landing-hero-heading"
        className="grid items-start gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8"
      >
        <div className="min-w-0 space-y-6">
          <div className="flex flex-wrap gap-2">
            <span className="tb-chip tb-chip-ok">
              <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
              for engineering teams
            </span>
            <span className="tb-chip">express · mongoose · commonjs</span>
            <span className="tb-chip tb-chip-accent">first safe cut</span>
          </div>

          <div className="space-y-3">
            <h1
              id="landing-hero-heading"
              className="max-w-2xl text-[2rem] font-semibold leading-[1.12] tracking-tight text-text-primary sm:text-[2.5rem]"
            >
              Turn one tangled Express domain into a verified module.
            </h1>
            <p className="max-w-xl text-[15px] leading-relaxed text-text-secondary sm:text-base">
              ToolBox finds a safe domain from code evidence, lets AI propose changes only after you
              authorize a Stage Plan, and applies nothing until you accept. Same deploy—not a fake
              microservice split.
            </p>
          </div>

          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <Link href="/app" className="tb-btn tb-btn-primary h-11 px-5 text-sm">
              Open work console
            </Link>
            <a href="#how-it-works" className="tb-btn tb-btn-secondary h-11 px-5 text-sm">
              See how it works
            </a>
          </div>

          <p className="max-w-xl text-[12px] leading-relaxed text-text-quiet">
            Reliable demo: work console →{" "}
            <span className="font-medium text-text-secondary">Try controlled example</span>
          </p>

          <dl className="grid max-w-lg grid-cols-3 gap-2 pt-1">
            {[
              { k: "Stages", v: "3–4" },
              { k: "AI role", v: "Bounded" },
              { k: "Deploy split", v: "Never" },
            ].map((item) => (
              <div
                key={item.k}
                className="rounded-md border border-border-subtle bg-surface-paper px-3 py-2.5 shadow-[var(--shadow-soft)]"
              >
                <dt className="tb-mono text-[10px] uppercase tracking-wide text-text-quiet">
                  {item.k}
                </dt>
                <dd className="mt-0.5 text-sm font-semibold text-text-primary">{item.v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <aside
          className="tb-panel min-w-0 overflow-hidden"
          aria-label="Sample Modernization Assessment"
        >
          <div className="tb-panel-head">
            <div className="min-w-0">
              <p className="tb-mono text-[10px] uppercase tracking-wide text-text-quiet">
                sample output
              </p>
              <p className="text-[12px] font-medium text-text-primary">Modernization Assessment</p>
            </div>
            <span className="tb-chip tb-chip-accent">phase: assessed</span>
          </div>
          <div className="space-y-3 p-3.5">
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { k: "routes", v: "9" },
                { k: "models", v: "3" },
                { k: "cycles", v: "1" },
                { k: "ready", v: "2" },
              ].map((m) => (
                <div
                  key={m.k}
                  className="rounded border border-border-subtle bg-surface-muted/60 px-2 py-1.5"
                >
                  <p className="tb-mono text-[9px] uppercase text-text-quiet">{m.k}</p>
                  <p className="tb-mono text-sm font-semibold tabular-nums text-text-primary">
                    {m.v}
                  </p>
                </div>
              ))}
            </div>

            <div className="overflow-hidden rounded border border-border-subtle">
              <div className="grid grid-cols-[2.25rem_1fr_3.25rem_3.5rem] gap-2 border-b border-border-subtle bg-surface-inset px-2.5 py-1.5 tb-mono text-[9px] uppercase tracking-wide text-text-quiet">
                <span>#</span>
                <span>candidate</span>
                <span className="text-right">score</span>
                <span className="text-right">state</span>
              </div>
              {SAMPLE_CANDIDATES.map((c) => (
                <div
                  key={c.name}
                  className={`grid grid-cols-[2.25rem_1fr_3.25rem_3.5rem] items-center gap-2 border-b border-border-subtle px-2.5 py-2 last:border-b-0 ${
                    c.rank === "01" ? "bg-accent-action/8" : "bg-surface-paper"
                  }`}
                >
                  <span className="tb-mono text-[11px] text-text-quiet">{c.rank}</span>
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-medium text-text-primary">{c.name}</p>
                    <p className="truncate tb-mono text-[10px] text-text-quiet">{c.detail}</p>
                  </div>
                  <span className="tb-mono text-right text-[12px] tabular-nums text-text-primary">
                    {c.score}
                  </span>
                  <span className="text-right">
                    {c.state === "ready" ? (
                      <span className="tb-chip tb-chip-ok">ready</span>
                    ) : (
                      <span className="tb-chip tb-chip-warn">block</span>
                    )}
                  </span>
                </div>
              ))}
            </div>

            <div className="rounded border border-border-subtle bg-surface-inset px-3 py-2.5">
              <p className="tb-mono text-[10px] uppercase tracking-wide text-text-quiet">
                stage plan · pending
              </p>
              <p className="mt-1.5 text-[12px] font-medium text-text-primary">
                Extract Orders Domain Module
              </p>
              <p className="mt-1 tb-mono text-[10px] leading-relaxed text-text-quiet">
                envelope: src/modules/orders/** · maxOps: 20
                <br />
                protect: route table · schema fingerprints
              </p>
            </div>
          </div>
        </aside>
      </section>

      <section
        id="why-toolbox"
        aria-labelledby="comparison-heading"
        className="tb-panel overflow-hidden"
      >
        <div className="tb-panel-head">
          <div>
            <h2 id="comparison-heading" className="text-[13px] font-semibold text-text-primary">
              From general-purpose AI to purpose-built modernization
            </h2>
            <p className="mt-0.5 text-[12px] text-text-secondary">
              AI coding assistants are powerful. ToolBox adds the structure, evidence, and validation
              gates that monolith modernization specifically needs.
            </p>
          </div>
          <span className="tb-chip tb-chip-accent">compare</span>
        </div>

        <div className="grid border-t border-border-subtle lg:grid-cols-2">
          <div className="min-w-0 border-b border-border-subtle lg:border-b-0 lg:border-r lg:border-border-subtle">
            <div className="flex items-center gap-2 border-b border-border-subtle bg-surface-inset/60 px-4 py-2.5">
              <span className="tb-chip">general</span>
              <h3 className="text-[13px] font-semibold text-text-primary">
                General-purpose AI assistant
              </h3>
            </div>
            <ul className="divide-y divide-border-subtle">
              {([
                {
                  label: "Discovery",
                  detail: "Responds based on available context. You describe what to extract; AI suggests based on the files it can see.",
                },
                {
                  label: "Evidence",
                  detail: "Conversational explanation. No structured dependency graph or scored readiness ranking.",
                },
                {
                  label: "Scope control",
                  detail: "Broad flexibility — AI can touch any file in a single response, which is great for general tasks.",
                },
                {
                  label: "Validation",
                  detail: "You verify the output manually or run your own test suite after each change.",
                },
                {
                  label: "Approval gate",
                  detail: "Changes are presented as a diff or applied directly. Review happens after generation.",
                },
                {
                  label: "Repair",
                  detail: "If something breaks, you iterate with follow-up prompts until it works.",
                },
              ] as const).map((row) => (
                <li key={row.label} className="px-4 py-2.5">
                  <p className="tb-mono text-[10px] uppercase tracking-wide text-text-quiet">{row.label}</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-text-secondary">{row.detail}</p>
                </li>
              ))}
            </ul>
            <div className="border-t border-border-subtle bg-surface-inset/60 px-4 py-2.5 text-[12px] leading-relaxed text-text-secondary">
              Excellent for general coding, debugging, and exploration. ToolBox builds on this
              foundation for one specialized job.
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 border-b border-border-subtle bg-diff-add-bg px-4 py-2.5">
              <span className="tb-chip tb-chip-ok">toolbox</span>
              <h3 className="text-[13px] font-semibold text-text-primary">
                With ToolBox
              </h3>
            </div>
            <ul className="divide-y divide-border-subtle">
              {([
                {
                  label: "Discovery",
                  detail: "Deterministic AST analysis ranks Domain Candidates by coupling, routes, models, and cycles — before AI is called.",
                },
                {
                  label: "Evidence",
                  detail: "Clickable code evidence — imports, callers, database writes — with scored readiness and blocking signals.",
                },
                {
                  label: "Scope control",
                  detail: "Stage Plan defines a path envelope and budget. AI generation stays inside the authorized boundary.",
                },
                {
                  label: "Validation",
                  detail: "Static Validation checks syntax, path scope, route table, and schema fingerprints automatically after every change.",
                },
                {
                  label: "Approval gate",
                  detail: "Explicit Change Acceptance after reviewing the validated diff. AI cannot self-apply any output.",
                },
                {
                  label: "Repair",
                  detail: "One bounded repair attempt with automatic re-validation. Second failure rolls back to last accepted snapshot.",
                },
              ] as const).map((row) => (
                <li key={row.label} className="px-4 py-2.5">
                  <p className="tb-mono text-[10px] uppercase tracking-wide text-text-quiet">{row.label}</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-text-secondary">{row.detail}</p>
                </li>
              ))}
            </ul>
            <div className="border-t border-border-subtle bg-surface-inset/60 px-4 py-2.5 text-[12px] leading-relaxed text-text-secondary">
              Purpose-built for monolith modernization. Every step is evidence-backed, bounded, and
              validated.
            </div>
          </div>
        </div>

        <div className="border-t border-border-subtle bg-surface-inset/40 px-4 py-3 text-[12px] leading-relaxed text-text-secondary">
          <strong className="font-medium text-text-primary">Built with Codex.</strong>{" "}
          ToolBox itself was developed using OpenAI Codex for planning, code generation, and testing —
          then adds deterministic analysis, validation, and approval gates on top.
        </div>
      </section>

      <section
        id="how-it-works"
        aria-labelledby="workflow-heading"
        className="tb-panel overflow-hidden"
      >
        <div className="tb-panel-head">
          <div>
            <h2 id="workflow-heading" className="text-[13px] font-semibold text-text-primary">
              Modernization workflow
            </h2>
            <p className="mt-0.5 text-[12px] text-text-secondary">
              Assessment and selection stay separate from Stage Plan authorization, validation, and
              Change Acceptance.
            </p>
          </div>
          <span className="tb-chip">five steps</span>
        </div>
        <ol className="divide-y divide-border-subtle">
          {WORKFLOW.map((step) => (
            <li
              key={step.step}
              className="grid gap-2 px-4 py-3.5 sm:grid-cols-[4.5rem_10rem_1fr] sm:items-start sm:gap-4"
            >
              <span className="tb-mono text-[11px] text-accent-action">{step.step}</span>
              <h3 className="text-[13px] font-semibold text-text-primary">{step.title}</h3>
              <p className="text-[13px] leading-relaxed text-text-secondary">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section
        id="controls"
        aria-labelledby="boundaries-heading"
        className="tb-panel overflow-hidden"
      >
        <div className="tb-panel-head">
          <div>
            <h2 id="boundaries-heading" className="text-[13px] font-semibold text-text-primary">
              Safety and non-goals
            </h2>
            <p className="mt-0.5 text-[12px] text-text-secondary">
              Honest limits ToolBox will not blur.
            </p>
          </div>
        </div>
        <div className="grid sm:grid-cols-2">
          {BOUNDARIES.map((item, index) => (
            <article
              key={item.title}
              className={`min-w-0 px-4 py-3.5 ${
                index < BOUNDARIES.length - 1 ? "border-b border-border-subtle" : ""
              } ${index % 2 === 0 ? "sm:border-r sm:border-border-subtle" : ""} ${
                index < 2 ? "sm:border-b sm:border-border-subtle" : "sm:border-b-0"
              } ${index === BOUNDARIES.length - 1 ? "border-b-0" : ""}`}
            >
              <h3 className="text-[13px] font-medium text-text-primary">{item.title}</h3>
              <p className="mt-1 text-[12px] leading-relaxed text-text-secondary">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="ledger-heading" className="overflow-hidden">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="ledger-heading" className="text-[15px] font-semibold text-text-primary">
              Responsibility ledger
            </h2>
            <p className="mt-0.5 max-w-2xl text-[13px] text-text-secondary">
              Deterministic components own eligibility, evidence, readiness, Stage Plans, and Static
              Validation. AI owns only authorized generation and one bounded repair. Developers own
              authorization and Change Acceptance.
            </p>
          </div>
        </div>
        <div className="tb-terminal overflow-hidden">
          <div className="hidden grid-cols-[minmax(0,1.5fr)_7.5rem_minmax(0,1.8fr)] gap-2 border-b border-terminal-border bg-surface-terminal-raised px-3 py-2 tb-mono text-[10px] uppercase tracking-wide text-terminal-fg-muted sm:grid">
            <span>Concern</span>
            <span>Owner</span>
            <span>Boundary</span>
          </div>
          <ul className="divide-y divide-terminal-border">
            {RESPONSIBILITY.map((row) => (
              <li
                key={row.concern}
                className="grid min-w-0 grid-cols-1 gap-1 px-3 py-2.5 sm:grid-cols-[minmax(0,1.5fr)_7.5rem_minmax(0,1.8fr)] sm:items-baseline sm:gap-2"
              >
                <p className="tb-mono text-[12px] text-terminal-fg">{row.concern}</p>
                <p
                  className={`tb-mono text-[11px] font-medium ${
                    row.owner === "AI"
                      ? "text-diff-change"
                      : row.owner === "Developer"
                        ? "text-diff-add"
                        : "text-terminal-fg-muted"
                  }`}
                >
                  {row.owner}
                </p>
                <p className="tb-mono text-[11px] leading-relaxed text-terminal-fg-muted">
                  {row.detail}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        id="contract"
        aria-labelledby="contract-heading"
        className="tb-panel overflow-hidden"
      >
        <details className="group">
          <summary className="tb-panel-head cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            <div className="min-w-0">
              <h2 id="contract-heading" className="text-[13px] font-semibold text-text-primary">
                Repository requirements
              </h2>
              <p className="mt-0.5 text-[12px] text-text-secondary">
                Full assessment contract and extra rules before generation.
              </p>
            </div>
            <span className="tb-chip group-open:tb-chip-accent">
              <span className="group-open:hidden">show</span>
              <span className="hidden group-open:inline">hide</span>
            </span>
          </summary>
          <div className="grid gap-0 border-t border-border-subtle lg:grid-cols-2">
            <div className="min-w-0 lg:border-r lg:border-border-subtle">
              <div className="border-b border-border-subtle px-4 py-2.5">
                <h3 className="text-[13px] font-semibold text-text-primary">
                  Requirements for assessment
                </h3>
                <p className="mt-0.5 text-[11px] text-text-quiet">enter assessment</p>
              </div>
              <ul className="divide-y divide-border-subtle">
                {ASSESSMENT_REQUIREMENTS.map((line, index) => (
                  <li key={line} className="flex items-start gap-3 px-4 py-2.5 text-[13px]">
                    <span className="tb-mono w-5 shrink-0 text-[10px] text-text-quiet">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="text-text-primary/90">{line}</span>
                  </li>
                ))}
              </ul>
              <div className="border-t border-border-subtle bg-surface-inset/60 px-4 py-2.5 text-[12px] leading-relaxed text-text-secondary">
                Support means the repository can enter Modernization Assessment. It does not mean
                every domain is transform-ready.
              </div>
            </div>
            <div className="min-w-0 border-t border-border-subtle lg:border-t-0">
              <div className="border-b border-border-subtle px-4 py-2.5">
                <h3 className="text-[13px] font-semibold text-text-primary">
                  Additional requirements for transformation
                </h3>
                <p className="mt-0.5 text-[11px] text-text-quiet">enter generation</p>
              </div>
              <ul className="divide-y divide-border-subtle">
                {TRANSFORMATION_REQUIREMENTS.map((line, index) => (
                  <li key={line} className="flex items-start gap-3 px-4 py-2.5 text-[13px]">
                    <span className="tb-mono w-5 shrink-0 text-[10px] text-text-quiet">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="text-text-primary/90">{line}</span>
                  </li>
                ))}
              </ul>
              <div className="border-t border-border-subtle bg-surface-inset/60 px-4 py-2.5 text-[12px] leading-relaxed text-text-secondary">
                Transformation Readiness is separate from repository eligibility. When no candidate
                is ready, ToolBox returns the assessment and blocking evidence without calling AI.
              </div>
            </div>
          </div>
        </details>
      </section>

      <section
        aria-labelledby="cta-heading"
        className="flex flex-col items-start justify-between gap-4 rounded-md border border-border-subtle bg-surface-paper px-5 py-4 shadow-[var(--shadow-soft)] sm:flex-row sm:items-center"
      >
        <div className="min-w-0">
          <h2 id="cta-heading" className="text-[14px] font-medium text-text-primary">
            Ready for the first safe cut?
          </h2>
          <p className="mt-0.5 text-[12px] text-text-secondary">
            Judges and first-time visitors: open the work console and run{" "}
            <strong className="font-medium text-text-primary">Try controlled example</strong>. Or
            paste a public GitHub root that matches the supported contract.
          </p>
        </div>
        <Link href="/app" className="tb-btn tb-btn-primary h-10 shrink-0 px-4">
          Go to work console
        </Link>
      </section>
    </div>
  );
}
