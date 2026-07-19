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

  it("retains exact unsupported route, mount, handler, model, and CRUD syntax evidence", async () => {
    const snapshot = loadFixtureSnapshot("unsupported-syntax");
    const analysis = await new ExpressAnalyzer().analyze([...snapshot.files.values()]);

    expect(analysis.unsupportedSyntax).toEqual([
      {
        kind: "mount",
        reason: "computed_or_non_literal_mount_prefix",
        file: "app.js",
        line: 6,
        snippet: "app.use(ordersPrefix, ordersRouter);",
        relatedFiles: ["routes/orders.js"],
      },
      {
        kind: "mount",
        reason: "direct_require_mount_target",
        file: "app.js",
        line: 10,
        snippet: 'app.use("/orders-direct", require("./routes/orders"));',
        relatedFiles: ["routes/orders.js"],
      },
      {
        kind: "mount",
        reason: "middleware_before_router_mount",
        file: "app.js",
        line: 11,
        snippet: 'app.use("/orders-secured", auth, ordersRouter);',
        relatedFiles: ["routes/orders.js"],
      },
      {
        kind: "model",
        reason: "non_literal_model_name",
        file: "models/Order.js",
        line: 6,
        snippet: "const Order = mongoose.model(modelName, orderSchema);",
      },
      {
        kind: "route",
        reason: "computed_or_non_literal_route_path",
        file: "routes/orders.js",
        line: 12,
        snippet: "router.get(dynamicPath, function dynamic(_req, res) {",
      },
      {
        kind: "handler",
        reason: "unsupported_handler_shape",
        file: "routes/orders.js",
        line: 15,
        snippet: 'router.get("/unsupported-handler", handlers[0]);',
      },
      {
        kind: "crud",
        reason: "unsupported_crud_method",
        file: "routes/orders.js",
        line: 21,
        snippet: "  await Order.bulkWrite([]);",
      },
    ]);
  });

  it("limits Express syntax evidence to proven bindings and detects computed and chained registrations", async () => {
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
const config = { get() { return '/not-a-route'; } };
const auth = (_req, _res, next) => next();
const app = express();
app.get('/health', (_req, res) => res.end());
config.get('key');
app.use('/orders', require('./routes/orders'));
app.use('/secured-orders', auth, require('./routes/orders'));
module.exports = app;`,
      ),
      createRepositoryFile(
        assertNormalizedPath("routes/orders.js"),
        `
const express = require('express');
const router = express.Router();
const method = 'get';
router[method]('/computed', (_req, res) => res.end());
router.route('/chained').get((_req, res) => res.end());
module.exports = router;`,
      ),
      createRepositoryFile(
        assertNormalizedPath("models/Order.js"),
        `
const mongoose = require('mongoose');
const schema = new mongoose.Schema({}, { collection: 'orders' });
module.exports = mongoose.model('Order', schema);`,
      ),
      createRepositoryFile(
        assertNormalizedPath("utils/PDF.js"),
        `
module.exports = { render() {} };`,
      ),
      createRepositoryFile(
        assertNormalizedPath("service.js"),
        `
const PDF = require('./utils/PDF');
PDF.render();`,
      ),
    ];
    const analysis = await new ExpressAnalyzer().analyze(files);
    expect(analysis.routes).toEqual([
      expect.objectContaining({ method: "get", path: "/health", file: "app.js" }),
    ]);
    expect(analysis.unsupportedSyntax).toEqual([
      {
        kind: "mount",
        reason: "direct_require_mount_target",
        file: "app.js",
        line: 8,
        snippet: "app.use('/orders', require('./routes/orders'));",
        relatedFiles: ["routes/orders.js"],
      },
      {
        kind: "mount",
        reason: "middleware_before_router_mount",
        file: "app.js",
        line: 9,
        snippet: "app.use('/secured-orders', auth, require('./routes/orders'));",
        relatedFiles: ["routes/orders.js"],
      },
      {
        kind: "route",
        reason: "computed_route_method",
        file: "routes/orders.js",
        line: 5,
        snippet: "router[method]('/computed', (_req, res) => res.end());",
      },
      {
        kind: "route",
        reason: "chained_route_registration",
        file: "routes/orders.js",
        line: 6,
        snippet: "router.route('/chained').get((_req, res) => res.end());",
      },
    ]);
  });

  it("preserves supported imported-router and public-module member mounts", async () => {
    const files = [
      createRepositoryFile(
        assertNormalizedPath("package.json"),
        JSON.stringify({
          name: "x",
          main: "app.js",
          dependencies: { express: "4", mongoose: "8" },
        }),
      ),
      createRepositoryFile(
        assertNormalizedPath("app.js"),
        `
const express = require('express');
const productsRouter = require('./routes/products');
const ordersModule = require('./modules/orders');
const app = express();
app.use('/products', productsRouter);
app.use('/orders', ordersModule.router);
module.exports = app;`,
      ),
      createRepositoryFile(
        assertNormalizedPath("routes/products.js"),
        `
const express = require('express');
const router = express.Router();
router.get('/list', (_req, res) => res.end());
module.exports = router;`,
      ),
      createRepositoryFile(
        assertNormalizedPath("modules/orders/index.js"),
        `module.exports = { router: require('./orders.routes') };`,
      ),
      createRepositoryFile(
        assertNormalizedPath("modules/orders/orders.routes.js"),
        `
const express = require('express');
const router = express.Router();
router.get('/list', (_req, res) => res.end());
module.exports = router;`,
      ),
      createRepositoryFile(
        assertNormalizedPath("models/Order.js"),
        `
const mongoose = require('mongoose');
const schema = new mongoose.Schema({}, { collection: 'orders' });
module.exports = mongoose.model('Order', schema);`,
      ),
    ];

    const analysis = await new ExpressAnalyzer().analyze(files);
    expect(analysis.routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ file: "routes/products.js", path: "/products/list" }),
        expect.objectContaining({
          file: "modules/orders/orders.routes.js",
          path: "/orders/list",
        }),
      ]),
    );
    expect(analysis.unsupportedSyntax).toEqual([]);
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
