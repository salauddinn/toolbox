# ToolBox

ToolBox helps engineering teams understand and begin modernizing an existing application without assuming that modernization requires microservices.

## Language

**Legacy Application**:
An existing application whose accumulated technical or architectural constraints make meaningful change difficult or risky.
_Avoid_: Old app, obsolete app

**Supported Repository**:
A repository that satisfies ToolBox's published eligibility contract and can enter the Modernization Assessment workflow. Support does not imply that every domain is safe to transform.
_Avoid_: Compatible codebase, any Express app

**Safety Screening**:
Deterministic checks that reject a repository when ToolBox detects a supported risk signal before analysis or AI use. Passing does not certify that a repository is safe or malware-free.
_Avoid_: Malware scan, security certification, trusted repository

**Modernization Assessment**:
An evidence-backed description of a Legacy Application's current condition and modernization constraints.
_Avoid_: Scan, audit, scorecard

**Modernization Finding**:
An evidence-backed condition in a Legacy Application that affects its modernization. A finding may be automatable or may require a developer decision.
_Avoid_: AI opinion, generic advice

**Automatable Finding**:
A Modernization Finding that ToolBox can address through a supported Change Set and evaluate with its declared validation contract.
_Avoid_: Automatic fix, guaranteed fix

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

**Stage Plan**:
The scoped purpose, evidence, expected affected files and validation criteria presented before a Change Set is generated.
_Avoid_: Prompt, task description

**Change Acceptance**:
The developer's explicit decision to apply a validated Change Set to the current repository snapshot.
_Avoid_: Generation approval, automatic apply

**Domain Module**:
A cohesive part of a Legacy Application organized around one business responsibility while remaining within the application's existing deployment boundary.
_Avoid_: Microservice, service

**Domain Candidate**:
A technically coherent area that ToolBox identifies as eligible to become a Domain Module. Its ranking reflects code evidence, not business importance.
_Avoid_: Best domain, most important domain

**Write Ownership**:
The responsibility for creating or mutating records represented by a model. Reading a model does not establish Write Ownership.
_Avoid_: Model usage, database access

**Transformation Readiness**:
The evidence-backed determination that at least one Domain Candidate can enter ToolBox's supported Modernization Sequence. It is separate from repository eligibility.
_Avoid_: Compatibility, confidence score

**Blocker**:
A Modernization Finding that prevents a clean Domain Module boundary. A Blocker may be automatable or may require a developer decision.
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
