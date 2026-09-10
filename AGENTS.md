# Agent / Specialist Chat Operating Contract

Every specialist chat working on this repository must follow this protocol.

## At Task Start
1. Read `PROJECT.md` and relevant architecture/contracts.
2. Read your own file under `docs/workstream-status/`.
3. Re-check latest `main` and any relevant branch/PR/test state. Never assume an old SHA is current.
4. State the source-of-truth ref used for the task.

## During Work
- Stay inside the assigned workstream boundary unless an interface change is required.
- For cross-system changes, stop at the contract boundary and route the decision to workstream 00.
- Preserve deterministic behavior where simulation reproducibility matters.
- Avoid reaction-specific hardcoding unless the exception hierarchy in `PROJECT.md` justifies it.
- Mark scientific certainty explicitly.

## At Task End
Update your canonical status file with:
- Last checked main SHA
- Active branch / PR
- Current objective
- Completed work
- In-progress work
- Blockers / OPEN questions
- Validation performed
- Next actions
- Handoff requests

If code changed, report exact tests run and their results. Do not claim PASS without evidence.

## Integration Flow
00 design/contract -> specialist implementation -> 06 validation -> 07 integration -> main.

Small isolated maintenance changes may skip a formal design phase, but cross-system contracts may not.
