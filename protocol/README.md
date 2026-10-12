# KISA Protocol v0.1

KISA is a domain-neutral epistemic and authority protocol for autonomous systems.

It does not replace CloudEvents, W3C PROV, JSON Schema, RFC 8785 JCS, in-toto, MCP, or A2A. It profiles compatible primitives around five requirements: frozen evidence, explicit decision provenance, bounded authority, prospective outcomes, and causal invalidation.

## Core ontology

- Entity — immutable or versioned thing with content identity.
- Activity — process that uses entities and generates entities.
- Agent — accountable software/model/human/system identity.
- Relation — typed causal/provenance edge.

Evidence, Decision, Outcome and CapabilityGrant are semantic Entity profiles. Lineage is the graph formed by Entities, Activities, Agents and Relations.

## Normative invariants

1. No semantic claim without provenance.
2. No Decision without frozen input identities.
3. No CapabilityGrant without a target Decision and explicit bounded scope.
4. Capability does not imply execution and technical access does not imply epistemic authority.
5. A prospective Outcome MUST NOT be observable before its Decision is frozen.
6. Invalidating a causal ancestor MUST taint every causal descendant until reconstruction/replay establishes a new clean lineage.
7. Content hashes establish identity/integrity, not truth or independence.
8. Independent evidence MUST use an explicit independence root/group; different URLs or hashes alone do not establish independence.

## Wire compatibility

Events SHOULD use a CloudEvents 1.0 compatible envelope. JSON schemas use Draft 2020-12. Cross-language content digests MUST be computed over RFC 8785 JCS canonical JSON (implementation may remain transitional until a conforming JCS implementation is installed).

## Status

v0.1 is experimental. KISASIGNALS is the first reference implementation. SWE-REPLAY-LAB and WORLD-0 are conformance consumers, not production dependencies.
