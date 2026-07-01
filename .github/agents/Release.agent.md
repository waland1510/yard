---
name: Release
description: Validates deployment readiness and generates a changelog entry. Sub-agent — invoked by Coordinator after CodeReview approval.
model: claude-sonnet-4-6
tools:
  - type: read_file
  - type: codebase_search
user-invokable: false
---

# Release

Read and follow `docs/instructions/personas/release.md` exactly.
