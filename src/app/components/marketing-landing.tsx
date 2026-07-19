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
    body: "Inspect the scoped Stage Plan—purpose, path envelope, and validation contract—then authorize generation. AI does not run until you authorize that stage.",
  },
  {
    step: "04",
    title: "Validate Change Set",
    body: "ToolBox runs Static Validation on the proposed Change Set. Checks examine repository artifacts only; they are not Runtime Validation and do not execute the application.",
  },
  {
    step: "05",
    title: "Accept changes",
    body: "Review the diff and Validation Report, then perform Change Acceptance. Only accepted Change Sets enter the current snapshot and the downloadable result ZIP.",
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
    title: "Support is not transform-ready",
    body: "Meeting the assessment contract lets a repository enter Modernization Assessment. It does not mean every domain can enter generation.",
  },
  {
    title: "One repair, then stop",
    body: "A failed Change Set may receive one bounded repair. A second Static Validation failure rolls back and keeps the last accepted snapshot.",
  },
] as const;

const SPECIMEN_LINES = [
  { tone: "muted", text: "# Modernization Assessment · specimen (illustrative)" },
  { tone: "muted", text: "# Input: public GitHub root · static analysis only" },
  { tone: "plain", text: "" },
  { tone: "key", text: "source          github:acme/orders-api" },
  { tone: "key", text: "eligibility     pass · express+mongoose · commonjs" },
  { tone: "key", text: "safety          pass · no supported risk signal" },
  { tone: "key", text: "analysis        routes=9  models=3  cycles=1" },
  { tone: "plain", text: "" },
  { tone: "muted", text: "# Domain Candidates ranked by code evidence" },
  {
    tone: "ok",
    text: "01  Orders     score=0.86  ready     exclusive write · 4 routes · Order",
  },
  {
    tone: "ok",
    text: "02  Payments   score=0.71  ready     cycle w/ Orders · 3 routes · Payment",
  },
  {
    tone: "warn",
    text: "03  Users      score=0.54  blocked   shared writes · readiness fails",
  },
  { tone: "plain", text: "" },
  { tone: "muted", text: "# Next human controls (not automatic)" },
  { tone: "accent", text: "decision       confirm ready candidate → Modernization Decision" },
  {
    tone: "accent",
    text: "authorize      Stage Plan S2 · path envelope src/modules/orders/**",
  },
  {
    tone: "muted",
    text: "validate       Static Validation only · not Runtime Validation",
  },
  {
    tone: "muted",
    text: "accept         Change Acceptance required before snapshot update",
  },
] as const;

function specimenClass(tone: (typeof SPECIMEN_LINES)[number]["tone"]): string {
  switch (tone) {
    case "muted":
      return "text-terminal-fg-muted";
    case "ok":
      return "text-diff-add";
    case "warn":
      return "text-diff-change";
    case "accent":
      return "text-terminal-fg";
    case "key":
      return "text-terminal-fg";
    default:
      return "text-terminal-fg";
  }
}

export function MarketingLanding() {
  return (
    <div className="space-y-10 pb-6 sm:space-y-12">
      {/* 1–2. Editorial hero + terminal assessment specimen */}
      <section
        aria-labelledby="landing-hero-heading"
        className="grid items-start gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8"
      >
        <div className="min-w-0 space-y-6">
          <div className="flex flex-wrap gap-2">
            <span className="tb-chip tb-chip-ok">
              <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
              for engineering teams
            </span>
            <span className="tb-chip">express · mongoose · commonjs</span>
            <span className="tb-chip">same deploy boundary</span>
            <span className="tb-chip tb-chip-accent">first safe cut</span>
          </div>

          <div className="space-y-4">
            <h1
              id="landing-hero-heading"
              className="tb-serif max-w-2xl text-[2rem] font-semibold leading-[1.15] tracking-tight text-text-primary sm:text-[2.55rem]"
            >
              Find a domain you can modularize safely. Prove it with code evidence. Let AI change
              only what you authorize.
            </h1>
            <p className="max-w-xl text-[15px] leading-relaxed text-text-secondary sm:text-base">
              ToolBox turns one tangled Express domain into an accepted Domain Module inside the
              existing deployment boundary—without rewriting the application or inventing a
              microservice split.
            </p>
            <p className="max-w-xl text-[15px] leading-relaxed text-text-secondary sm:text-base">
              <strong className="font-medium text-text-primary">Input:</strong> a public GitHub root
              repository that meets the assessment contract, or the controlled example.{" "}
              <strong className="font-medium text-text-primary">Outcome:</strong> an evidence-backed
              Modernization Assessment, then—when you choose—a sequence of bounded Change Sets that
              extract one Domain Module. AI proposes source edits only after you authorize a Stage
              Plan. Deterministic Static Validation checks every proposal. Nothing enters the
              snapshot until your Change Acceptance. Static Validation is not Runtime Validation.
            </p>
          </div>

          <aside
            className="max-w-xl rounded-md border border-accent-action/25 bg-accent-action/5 px-3.5 py-3"
            aria-label="Hackathon demo path"
          >
            <p className="tb-mono text-[10px] uppercase tracking-wide text-accent-action">
              hackathon judges · ~3 minutes
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">
              Open the work console and use{" "}
              <strong className="font-medium text-text-primary">Try controlled example</strong>.
              Ranked candidates → click evidence → authorize one Stage Plan → accept the Change Set
              → download the result ZIP. Prefer the fixture path over a random public repository.
            </p>
          </aside>

          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <Link href="/app" className="tb-btn tb-btn-primary h-11 px-5 text-sm">
              Open work console
            </Link>
            <a href="#how-it-works" className="tb-btn tb-btn-secondary h-11 px-5 text-sm">
              See the workflow
            </a>
          </div>

          <dl className="grid max-w-xl grid-cols-1 gap-2 min-[420px]:grid-cols-3">
            {[
              { k: "AI role", v: "Bounded generation" },
              { k: "Authorization", v: "Per Stage Plan" },
              { k: "Acceptance", v: "Developer only" },
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
          className="tb-terminal min-w-0 overflow-hidden"
          aria-label="Illustrative Modernization Assessment specimen"
        >
          <div className="flex items-center justify-between gap-3 border-b border-terminal-border bg-surface-terminal-raised px-3 py-2">
            <div className="min-w-0">
              <p className="tb-mono text-[10px] uppercase tracking-wide text-terminal-fg-muted">
                assessment specimen
              </p>
              <p className="truncate text-[12px] font-medium text-terminal-fg">
                Evidence summary · not a live run
              </p>
            </div>
            <span className="tb-mono shrink-0 rounded border border-terminal-border bg-surface-terminal px-1.5 py-0.5 text-[10px] text-terminal-fg-muted">
              static only
            </span>
          </div>
          <pre
            className="overflow-x-auto p-3.5 tb-mono text-[11px] leading-[1.55] selection:bg-accent-action/35 selection:text-terminal-fg"
            tabIndex={0}
          >
            <code>
              {SPECIMEN_LINES.map((line, index) => (
                <span key={`${index}-${line.text}`} className={`block ${specimenClass(line.tone)}`}>
                  {line.text || "\u00a0"}
                </span>
              ))}
            </code>
          </pre>
        </aside>
      </section>

      {/* 3. Five-step modernization workflow */}
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

      {/* 4. Deterministic vs AI responsibility ledger */}
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

      {/* 5. Assessment vs transformation requirements */}
      <section
        id="contract"
        aria-labelledby="contract-heading"
        className="grid gap-4 lg:grid-cols-2"
      >
        <div className="tb-panel min-w-0 overflow-hidden">
          <div className="tb-panel-head">
            <h2 id="contract-heading" className="text-[13px] font-semibold text-text-primary">
              Requirements for assessment
            </h2>
            <span className="tb-chip">enter assessment</span>
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
            Support means the repository can enter Modernization Assessment. It does not mean every
            domain is transform-ready.
          </div>
        </div>

        <div className="tb-panel min-w-0 overflow-hidden">
          <div className="tb-panel-head">
            <h2 className="text-[13px] font-semibold text-text-primary">
              Additional requirements for transformation
            </h2>
            <span className="tb-chip tb-chip-accent">enter generation</span>
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
            Transformation Readiness is separate from repository eligibility. When no candidate is
            ready, ToolBox returns the assessment and blocking evidence without calling AI.
          </div>
        </div>
      </section>

      {/* 6. Safety and non-goal boundaries */}
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
        <div className="grid sm:grid-cols-2 lg:grid-cols-3">
          {BOUNDARIES.map((item, index) => (
            <article
              key={item.title}
              className={`min-w-0 px-4 py-3.5 ${index < 3 ? "border-b border-border-subtle" : ""} ${
                index % 3 !== 2 ? "lg:border-r lg:border-border-subtle" : ""
              } ${index % 2 === 0 ? "sm:border-r sm:border-border-subtle" : ""} ${
                index < 4 ? "sm:border-b sm:border-border-subtle" : ""
              } ${index >= 3 ? "border-b border-border-subtle sm:border-b-0" : ""} ${
                index === 4 ? "lg:border-b-0" : ""
              } ${index === 5 ? "border-b-0 sm:border-b-0" : ""}`}
            >
              <h3 className="text-[13px] font-medium text-text-primary">{item.title}</h3>
              <p className="mt-1 text-[12px] leading-relaxed text-text-secondary">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* 7. Final work-console CTA */}
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
