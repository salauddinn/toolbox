# Use a long-lived single-process Node host

The hosted MVP uses one long-lived Node.js process because active runs, source snapshots, accepted Change Sets and short-lived caches are intentionally held in memory. Stateless or horizontally scaled serverless deployment would lose or split run state without adding a persistent store, which is outside the locked data-lifetime policy.

## Consequences

Deploy one application instance on a long-lived Node host, expire inactive state after 30 minutes, expose a health endpoint, and document that process restarts discard active runs. Horizontal scaling and durable recovery remain out of scope.
