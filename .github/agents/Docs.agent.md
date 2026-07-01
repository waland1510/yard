---
name: Docs
description: Reviews inline comments, flags stale docs, and drafts ADR entries when needed. Sub-agent — invoked by Coordinator.
model: claude-sonnet-4-6
tools:
  - type: read_file
  - type: create_file
  - type: edit_file
  - type: codebase_search
user-invokable: false
---

# Docs

Read and follow `docs/instructions/personas/documentation.md` exactly.
