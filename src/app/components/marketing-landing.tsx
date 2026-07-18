import Link from "next/link";

const PIPELINE = [
  { step: "01", label: "Load", detail: "Public repo snapshot only" },
  { step: "02", label: "Screen", detail: "Safety + eligibility gates" },
  { step: "03", label: "Analyze", detail: "Routes, models, cycles" },
  { step: "04", label: "Rank", detail: "Domain Candidates by evidence" },
  { step: "05", label: "Sequence", detail: "Bounded Stage Plans" },
  { step: "06", label: "Deliver", detail: "Accepted Change Sets + ZIP" },
] as const;

const STAGES = [
  {
    id: "S1",
    title: "Behaviour capture",
    kind: "Required",
    body: "Lock observable routes and ownership signals before structure moves.",
  },
  {
    id: "S2",
    title: "Domain Module extract",
    kind: "Required",
    body: "Pull one cohesive Domain Candidate into a module inside the same deploy.",
  },
  {
    id: "S3",
    title: "Integration cleanup",
    kind: "Required",
    body: "Rewire supported consumers and remove only superseded legacy paths.",
  },
  {
    id: "S4",
    title: "Cycle repair",
    kind: "Conditional",
    body: "Runs when entry-reachable cycles block a clean module boundary.",
  },
] as const;

const CANDIDATES = [
  {
    rank: "01",
    name: "Orders",
    score: "0.86",
    state: "ready",
    detail: "Exclusive write ownership · 4 routes · Order",
  },
  {
    rank: "02",
    name: "Payments",
    score: "0.71",
    state: "ready",
    detail: "Cycle with Orders · 3 routes · Payment",
  },
  {
    rank: "03",
    name: "Users",
    score: "0.54",
    state: "blocked",
    detail: "Shared writes · readiness fails",
  },
] as const;

const CONTROLS = [
  {
    title: "Safety before AI",
    body: "Safety Screening and eligibility finish before any generation call.",
  },
  {
    title: "Static analysis only",
    body: "Untrusted repositories are never installed or executed by ToolBox.",
  },
  {
    title: "Stage envelopes",
    body: "Each Change Set is constrained to path budgets and protected regions.",
  },
  {
    title: "One repair, then stop",
    body: "A second validation failure rolls back and keeps the current snapshot.",
  },
  {
    title: "Human authorization",
    body: "You authorize every stage and accept every Change Set before it sticks.",
  },
  {
    title: "Honest artifacts",
    body: "The result ZIP contains only accepted files plus a Validation Report.",
  },
] as const;

const CONTRACT = [
  "Public GitHub root repository",
  "Single-root npm · JavaScript CommonJS",
  "Express.js + Mongoose dependencies",
  "Entry point: app.js, server.js, or index.js",
  "At least one route and one Mongoose model",
  "Jest/Supertest available via npm test",
  "At most 150 analyzed files and 2 MB of source",
] as const;

export function MarketingLanding() {
  return (
    <div className="space-y-10 pb-6 sm:space-y-12">
      <section className="grid items-start gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8">
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <span className="tb-chip tb-chip-ok">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              for engineering teams
            </span>
            <span className="tb-chip">express · mongoose · commonjs</span>
            <span className="tb-chip">no microservices required</span>
          </div>

          <div className="space-y-3">
            <h1 className="max-w-2xl text-[2rem] font-semibold leading-[1.12] tracking-tight text-ink sm:text-[2.5rem]">
              Turn one tangled Express domain into a verified module.
            </h1>
            <p className="max-w-xl text-[15px] leading-relaxed text-muted sm:text-base">
              ToolBox finds a safe domain boundary from code evidence, uses AI to generate bounded
              Change Sets, and validates every proposed change before you accept it. No rewrite or
              deployment split required.
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

          <dl className="grid max-w-lg grid-cols-3 gap-2 pt-1">
            {[
              { k: "Stages", v: "3–4" },
              { k: "AI role", v: "Bounded" },
              { k: "Deploy split", v: "Never" },
            ].map((item) => (
              <div
                key={item.k}
                className="rounded-md border border-border bg-surface px-3 py-2.5 shadow-[var(--shadow-soft)]"
              >
                <dt className="tb-mono text-[10px] uppercase tracking-wide text-muted">{item.k}</dt>
                <dd className="mt-0.5 text-sm font-semibold text-ink">{item.v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <aside className="tb-panel overflow-hidden" aria-label="Sample Modernization Assessment">
          <div className="tb-panel-head">
            <div>
              <p className="tb-mono text-[10px] uppercase tracking-wide text-muted">
                sample output
              </p>
              <p className="text-[12px] font-medium text-ink">Modernization Assessment</p>
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
                  className="rounded border border-border bg-surface-muted/60 px-2 py-1.5"
                >
                  <p className="tb-mono text-[9px] uppercase text-muted">{m.k}</p>
                  <p className="tb-mono text-sm font-semibold tabular-nums text-ink">{m.v}</p>
                </div>
              ))}
            </div>

            <div className="overflow-hidden rounded border border-border">
              <div className="grid grid-cols-[2.25rem_1fr_3.25rem_3.5rem] gap-2 border-b border-border bg-panel-head px-2.5 py-1.5 tb-mono text-[9px] uppercase tracking-wide text-muted">
                <span>#</span>
                <span>candidate</span>
                <span className="text-right">score</span>
                <span className="text-right">state</span>
              </div>
              {CANDIDATES.map((c) => (
                <div
                  key={c.name}
                  className={`grid grid-cols-[2.25rem_1fr_3.25rem_3.5rem] items-center gap-2 border-b border-border px-2.5 py-2 last:border-b-0 ${
                    c.rank === "01" ? "bg-accent-soft/45" : "bg-surface"
                  }`}
                >
                  <span className="tb-mono text-[11px] text-muted">{c.rank}</span>
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-medium text-ink">{c.name}</p>
                    <p className="truncate tb-mono text-[10px] text-muted">{c.detail}</p>
                  </div>
                  <span className="tb-mono text-right text-[12px] tabular-nums text-ink">
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

            <div className="rounded border border-border bg-code-bg p-3 text-code-fg">
              <p className="tb-mono text-[10px] uppercase tracking-wide text-code-fg/55">
                stage plan · pending
              </p>
              <p className="mt-1.5 text-[12px] font-medium">Extract Orders Domain Module</p>
              <p className="mt-1 tb-mono text-[10px] leading-relaxed text-code-fg/65">
                envelope: src/modules/orders/** · maxOps: 20
                <br />
                protect: route table · schema fingerprints
              </p>
            </div>
          </div>
        </aside>
      </section>

      <section id="how-it-works" className="tb-panel overflow-hidden">
        <div className="tb-panel-head">
          <p className="tb-mono text-[11px] font-medium text-ink">how it works</p>
          <p className="tb-mono text-[10px] text-muted">
            deterministic evidence · bounded AI generation
          </p>
        </div>
        <ol className="grid sm:grid-cols-3 lg:grid-cols-6">
          {PIPELINE.map((p, i) => (
            <li
              key={p.step}
              className={`px-3.5 py-3.5 ${
                i < PIPELINE.length - 1 ? "border-b border-border sm:border-b-0 sm:border-r" : ""
              }`}
            >
              <p className="tb-mono text-[10px] text-accent">{p.step}</p>
              <p className="mt-1 text-[13px] font-medium text-ink">{p.label}</p>
              <p className="mt-0.5 text-[11px] text-muted">{p.detail}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="tb-panel overflow-hidden">
          <div className="tb-panel-head">
            <p className="tb-mono text-[11px] font-medium text-ink">modernization sequence</p>
            <span className="tb-chip">3 required · 1 conditional</span>
          </div>
          <ul className="divide-y divide-border">
            {STAGES.map((s) => (
              <li key={s.id} className="flex items-start gap-3 px-4 py-3.5">
                <span className="tb-mono mt-0.5 rounded border border-border bg-surface-muted px-1.5 py-0.5 text-[10px] text-muted">
                  {s.id}
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[13px] font-medium text-ink">{s.title}</p>
                    <span className={s.kind === "Required" ? "tb-chip" : "tb-chip tb-chip-warn"}>
                      {s.kind.toLowerCase()}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-muted">{s.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div id="contract" className="tb-panel overflow-hidden">
          <div className="tb-panel-head">
            <p className="tb-mono text-[11px] font-medium text-ink">supported contract</p>
            <span className="tb-chip tb-chip-accent">eligibility gate</span>
          </div>
          <ul className="divide-y divide-border">
            {CONTRACT.map((line, i) => (
              <li key={line} className="flex items-start gap-3 px-4 py-2.5 text-[13px]">
                <span className="tb-mono w-5 shrink-0 text-[10px] text-muted">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-ink/90">{line}</span>
              </li>
            ))}
          </ul>
          <div className="border-t border-border bg-surface-muted/50 px-4 py-2.5 text-[11px] text-muted">
            Support means the repo can enter assessment. It does not mean every domain is
            transform-ready, and Safety Screening is not malware certification.
          </div>
        </div>
      </section>

      <section id="controls" className="tb-panel overflow-hidden">
        <div className="tb-panel-head">
          <p className="tb-mono text-[11px] font-medium text-ink">operating controls</p>
          <p className="tb-mono text-[10px] text-muted">what ToolBox will not skip</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3">
          {CONTROLS.map((c, i) => (
            <article
              key={c.title}
              className={`px-4 py-3.5 ${i < 3 ? "border-b border-border" : ""} ${
                i % 3 !== 2 ? "lg:border-r lg:border-border" : ""
              } ${i % 2 === 0 ? "sm:border-r sm:border-border" : ""} ${i < 4 ? "sm:border-b" : ""}`}
            >
              <p className="text-[13px] font-medium text-ink">{c.title}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted">{c.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="flex flex-col items-start justify-between gap-4 rounded-md border border-border bg-surface px-5 py-4 shadow-[var(--shadow-soft)] sm:flex-row sm:items-center">
        <div>
          <p className="text-[14px] font-medium text-ink">Ready to run an assessment?</p>
          <p className="mt-0.5 text-[12px] text-muted">
            Open the work console to try the controlled example or paste a public GitHub URL.
          </p>
        </div>
        <Link href="/app" className="tb-btn tb-btn-primary h-10 px-4">
          Go to work console
        </Link>
      </section>
    </div>
  );
}
