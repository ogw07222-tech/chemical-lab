# Development Workflow

## Standard Feature Flow
1. HQ problem definition
2. Scientific model decision
3. Cross-system contract
4. Performance budget / risks
5. Specialist implementation
6. Specialist targeted tests
7. Workstream 06 scientific/regression validation
8. Workstream 07 integration review
9. Merge to `main`
10. Status files updated

## Branch Naming
Recommended:
- `feature/01-...`
- `feature/02-...`
- `feature/04-...`
- `ui/05-...`
- `validation/06-...`
- `integration/07-...`
- `docs/00-...`

## PR Requirements
PR descriptions should include:
- owning workstream
- problem being solved
- contract/API impact
- scientific assumptions/status
- tests run
- performance implications
- known OPEN items

## Status Synchronization
The workstream Markdown file is the canonical chat-to-repository handoff. A chat should update its status file in the same branch/PR when practical. After merge, the status must point to the new `main` state rather than an obsolete feature SHA.

## Cost / CI Policy
Batch related changes, test locally before push where possible, avoid redundant workflow reruns, reuse an existing PR for the same coherent task, and reserve expensive full-suite runs for meaningful checkpoints.
