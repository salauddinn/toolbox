const request = require("supertest");
const { createApp } = require("../app");

describe("controlled example routes", () => {
  const app = createApp();

  it("reports health", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("creates and lists orders with inline business logic", async () => {
    const created = await request(app).post("/orders").send({ userId: "u1", total: 42.5 });
    expect(created.status).toBe(201);
    expect(created.body.order.userId).toBe("u1");
    expect(created.body.order.total).toBe(42.5);
    expect(created.body.payment.status).toBe("quoted");

    const listed = await request(app).get("/orders");
    expect(listed.status).toBe(200);
    expect(listed.body.orders.length).toBeGreaterThanOrEqual(1);
  });

  it("creates payments", async () => {
    const res = await request(app).post("/payments").send({ orderId: "ord_1", amount: 10 });
    expect(res.status).toBe(201);
    expect(res.body.payment.orderId).toBe("ord_1");
  });

  it("creates users", async () => {
    const res = await request(app).post("/users").send({ email: "a@example.com", name: "Ada" });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe("a@example.com");
  });
});
