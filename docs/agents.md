# Agent Operating System

> **Version:** 1.0  
> **Status:** Active

AI agents accelerate delivery by handling repeatable verification tasks and surfacing issues early. Human judgment owns final decisions on all gated steps.

---

## Principles

| Principle | Meaning |
|-----------|---------|
| **Intent over lines** | Agents understand the goal of a change, not just the diff |
| **Verification is core** | Every agent must emit an `acceptance_checks` block |
| **Minimal footprint** | Targeted patches only — no speculative refactors |
| **Repo-grounded** | Agents read `docs/README.md` before acting |
| **Escalate, don't guess** | Ambiguous ownership → `needs_human: true` |
| **Audit trail** | All outputs appended to `agents-report.json`; never overwritten |

---

## Agent Roster

### Core Delivery

| Agent | File | Responsibility |
|-------|------|---------------|
| **Lead** | `personas/lead.md` | Decomposes intent into tasks; owns the plan |
| **Coordinator** | `personas/coordinator.md` | Sequences tasks, manages gating |
| **Developer** | `personas/developer.md` | Generates/modifies code within layer contracts |
| **CodeReview** | `personas/code-review.md` | Checks every patch against coding standards |
| **QA** | `personas/qa.md` | Generates and verifies tests |
| **Docs** | `personas/documentation.md` | Inline comments, ADR entries, README hygiene |

### Quality & Risk

| Agent | File | Responsibility |
|-------|------|---------------|
| **Security** | `personas/security.md` | Dependency scanning, PII log checks, input validation |
| **Release** | `personas/release.md` | Changelog, branch validation, deployment readiness |

---

## Orchestration Model

```
Feature Developer (entry point)
 ├─► Lead                                  ← Round 0: gate check + task plan
 └─► Coordinator
       ├─► Developer                       ← Round 1: code first
       ├─► [parallel] QA + Docs            ← Round 2: tests + docs
       ├─► [parallel] Security             ← Round 3: quality gates
       ├─► CodeReview                      ← Round 4: after Security
       └─► Release                         ← Round 5: only if CodeReview approved
```

**QA runs after Developer** — QA must reference actual function names and signatures from Developer's output.

---

## Hard Gates

| Gate | Condition | Action |
|------|-----------|--------|
| **Shared contract change** | Change touches `shared-utils/src/lib/` | `needs_human: true`; coordinate frontend + backend |
| **Backend change** | Change touches `apps/backend/` | Allowed — follow backend standards; coordinate if it also touches `shared-utils` / WebSocket protocol |
| **WebSocket protocol change** | New event types or payload shape changes | `breaking_change: true`; Lead re-confirms scope |
| **Quality gate failure** | CodeReview or Security finds a blocker | `status: blocked`; no downstream agents run |
| **Deduction engine change** | Change touches `deduction-engine.ts` | `needs_human: true`; verify with unit tests before proceeding |

---

## Escalation Rules

1. **Unknown ownership** → `needs_human: true`; explain which area needs a decision.
2. **Confidence below 0.6** → emit `needs_human: true` with explanation.
3. **Dependency on backend data shape** → flag as `needs_human: true`; don't assume.

---

## JSON Output Contract

Every agent emits this structure:

```json
{
  "agent": "<name>",
  "status": "success | blocked | needs_human",
  "confidence": 0.0,
  "needs_human": false,
  "artifacts": [
    { "file": "", "action": "created | modified | deleted", "summary": "" }
  ],
  "issues": [],
  "acceptance_checks": [
    { "check": "", "method": "", "passed": true, "evidence": "" }
  ],
  "audit": {
    "intent_ref": "",
    "timestamp": "",
    "agent_version": "1.0"
  }
}
```

Output is appended to `agents-report.json` at the repo root.
