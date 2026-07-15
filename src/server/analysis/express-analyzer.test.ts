import { describe, expect, it } from "vitest";
import { loadFixtureSnapshot } from "@/fixtures/load-fixture";
import { ExpressAnalyzer } from "./express-analyzer";
import { createRepositoryFile } from "@/core/repository";
import { assertNormalizedPath } from "@/core/paths";

describe("ExpressAnalyzer.analyze", () => {
  it("extracts routes, models, cycle, and findings from the controlled example", async () => {
    const snapshot = loadFixtureSnapshot("controlled-example");
    const analyzer = new ExpressAnalyzer();
    const analysis = await analyzer.analyze([...snapshot.files.values()]);

    expect(analysis.entryPath).toBe("app.js");
    expect(analysis.runtime.expressVersion).toBeTruthy();
    expect(analysis.models.map((m) => m.modelName).sort()).toEqual(
      expect.arrayContaining(["Order", "Payment", "User"]),
    );
    expect(analysis.routes.some((r) => r.method === "post" && r.path.includes("orders"))).toBe(
      true,
    );
    expect(analysis.graph.cycles.length).toBeGreaterThanOrEqual(1);
    const cycleFiles = analysis.graph.cycles.flatMap((c) => c.files);
    expect(cycleFiles.some((f) => f.includes("orders"))).toBe(true);
    expect(cycleFiles.some((f) => f.includes("payments"))).toBe(true);

    expect(analysis.modelAccess.some((a) => a.modelName === "Order" && a.kind === "write")).toBe(
      true,
    );
    expect(analysis.findings.some((f) => f.id === "route-db-coupling")).toBe(true);
    expect(analysis.findings.some((f) => f.remediation === "automatable")).toBe(true);
    expect(analysis.findings.every((f) => f.evidence.every((e) => e.file && e.line >= 1))).toBe(
      true,
    );
  });

  it("is deterministic for the same snapshot", async () => {
    const snapshot = loadFixtureSnapshot("controlled-example");
    const analyzer = new ExpressAnalyzer();
    const files = [...snapshot.files.values()];
    const a = await analyzer.analyze(files);
    const b = await analyzer.analyze(files);
    expect(a.contentHash).toBe(b.contentHash);
    expect(a.routes).toEqual(b.routes);
    expect(a.models).toEqual(b.models);
    expect(a.graph.cycles.map((c) => [...c.files].sort())).toEqual(
      b.graph.cycles.map((c) => [...c.files].sort()),
    );
  });

  it("records unsupported non-literal route paths", async () => {
    const files = [
      createRepositoryFile(
        assertNormalizedPath("package.json"),
        JSON.stringify({
          name: "x",
          main: "app.js",
          dependencies: { express: "4", mongoose: "8" },
          devDependencies: { jest: "29", supertest: "7" },
          scripts: { test: "jest" },
        }),
      ),
      createRepositoryFile(
        assertNormalizedPath("app.js"),
        `
const express = require('express');
const mongoose = require('mongoose');
const app = express();
const path = '/dyn';
app.get(path, (req, res) => res.end());
const Schema = new mongoose.Schema({ n: String }, { collection: 'items' });
const Item = mongoose.models.Item || mongoose.model('Item', Schema);
app.get('/items', async (req, res) => {
  await Item.find({});
  res.json([]);
});
module.exports = app;
`,
      ),
    ];
    const analyzer = new ExpressAnalyzer();
    expect(analyzer.supports(files).eligible).toBe(true);
    const analysis = await analyzer.analyze(files);
    // literal /items still extracted; computed path not registered as static route path value
    expect(analysis.routes.some((r) => r.path === "/items")).toBe(true);
    expect(analysis.routes.some((r) => r.path === "/dyn")).toBe(false);
  });
});
