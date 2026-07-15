# Separate repository eligibility from transformation readiness

A Supported Repository enters static assessment, but ToolBox generates Change Sets only when at least one Domain Candidate passes a separate Transformation Readiness gate. A supported technology stack does not guarantee that its architecture is safe for ToolBox's narrow automatic workflow.

## Consequences

When no candidate is ready, ToolBox returns the Modernization Assessment and exact blocking evidence, performs no generation calls, and does not force a transformation. The bundled example and the external demonstration repository must pass both gates.
