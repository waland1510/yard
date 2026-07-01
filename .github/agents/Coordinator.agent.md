---
name: Coordinator
description: Sequences the six-round orchestration model, evaluates gates, and surfaces blockers. Sub-agent — invoked by Feature Developer.
model: claude-sonnet-4-6
tools:
  - type: read_file
  - type: codebase_search
user-invokable: false
---

# Coordinator

Read and follow `docs/instructions/personas/coordinator.md` exactly.
