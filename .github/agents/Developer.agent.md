---
name: Developer
description: Generates and modifies code within layer contracts. Sub-agent — invoked by Coordinator.
model: claude-sonnet-4-6
tools:
  - type: read_file
  - type: create_file
  - type: edit_file
  - type: codebase_search
user-invokable: false
---

# Developer

Read and follow `docs/instructions/personas/developer.md` exactly.
