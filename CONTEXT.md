# ToolBox

ToolBox helps engineering teams understand and begin modernizing an existing application without assuming that modernization requires microservices.

## Language

**Legacy Application**:
An existing application whose accumulated technical or architectural constraints make meaningful change difficult or risky.
_Avoid_: Old app, obsolete app

**Modernization Assessment**:
An evidence-backed description of a Legacy Application's current condition and modernization constraints.
_Avoid_: Scan, audit, scorecard

**Modernization Recommendation**:
ToolBox's proposed technical modernization direction based on the Modernization Assessment. It remains advisory, does not establish business priority, and must be confirmed by the developer.
_Avoid_: AI decision, migration decision

**Modernization Decision**:
A Modernization Recommendation that the developer has explicitly confirmed as the direction to pursue.
_Avoid_: Automatic decision, AI decision

**Change Set**:
A bounded group of proposed changes that advances one Modernization Decision and remains subject to developer review.
_Avoid_: Migration, automatic fix, completed modernization

**Modernization Sequence**:
An ordered series of Change Sets that collectively advances a confirmed Modernization Decision.
_Avoid_: One-shot conversion, full rewrite

**Domain Module**:
A cohesive part of a Legacy Application organized around one business responsibility while remaining within the application's existing deployment boundary.
_Avoid_: Microservice, service

**Domain Candidate**:
A technically coherent area that ToolBox identifies as eligible to become a Domain Module. Its ranking reflects code evidence, not business importance.
_Avoid_: Best domain, most important domain

**Blocker**:
A statically detected obstacle, such as direct cross-domain access or a circular dependency, that prevents a clean Domain Module boundary and triggers the conditional blocker-resolution Change Set. Only a supported evidence rule, never the AI, may introduce it.
_Avoid_: Code smell, tech debt

**Modernization Intent**:
Optional developer-provided context describing the desired outcome or constraints for a selected Domain Candidate.
_Avoid_: AI prompt, business requirement

**Validation Report**:
A record of the checks actually performed on a Change Set and their outcomes; it makes no claims about checks that were not run.
_Avoid_: Proof, guarantee, certification

**Static Validation**:
Validation that examines repository artifacts without installing dependencies or executing application code.
_Avoid_: Test run, runtime verification

**Runtime Validation**:
Validation that executes application code or tests in a controlled environment.
_Avoid_: Static check, inferred behaviour
