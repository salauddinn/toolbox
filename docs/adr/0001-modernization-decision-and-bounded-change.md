# Make a recommendation, then generate one bounded change

Status: superseded by ADR-0002

ToolBox will produce an evidence-backed Modernization Recommendation rather than assume every Legacy Application should become microservices. The developer must confirm that recommendation before ToolBox generates one reviewable Change Set, and ToolBox will report only the validation checks it actually performed. This balances a tangible product outcome with human ownership of consequential architecture decisions and avoids claiming autonomous modernization.

## Considered Options

- Assessment only was rejected because it lacks a tangible implementation payoff.
- Automatic end-to-end modernization was rejected because code alone cannot establish business intent and the resulting changes cannot be safely guaranteed.

## Consequences

The product flow must preserve a visible confirmation boundary between recommendation and generation, and every generated Change Set must include a Validation Report with explicitly bounded claims.
