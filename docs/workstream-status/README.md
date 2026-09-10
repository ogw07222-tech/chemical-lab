# Workstream Status System

This directory is the canonical progress ledger shared by all specialist chats.

## How HQ Checks Project State
HQ should inspect all `00-...md` through `07-...md` files plus current GitHub branches/PRs/tests. Memory from old chats is not sufficient evidence of current implementation state.

## Required Status Fields
Each workstream file must maintain:
- Owner / role
- Current phase
- Overall state: NOT_STARTED / ACTIVE / BLOCKED / VALIDATING / READY_FOR_INTEGRATION / INTEGRATED
- Last updated date
- Last checked `main` SHA
- Active branch
- Active PR
- Current objective
- Completed
- In progress
- Blockers / OPEN
- Validation evidence
- Next actions
- Handoffs

## Rules
- Update the file before ending a meaningful task.
- Use exact SHA/PR/test evidence when available.
- `PASS` means tested evidence exists.
- Use `OPEN` instead of guessing.
- After a PR merges, replace stale branch state with the merged `main` state.
- Cross-workstream blockers must name the destination workstream.
