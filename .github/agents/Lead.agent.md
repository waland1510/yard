---
name: Lead
description: Decomposes intent into a task plan and validates hard gates. Sub-agent — invoked by Feature Developer.
model: claude-sonnet-4-6
tools:
  - type: read_file
  - type: codebase_search
user-invokable: false
---

# Lead

Read and follow `docs/instructions/personas/lead.md` exactly.
