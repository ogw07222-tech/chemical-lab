# 05 — Web UI

- Owner: Lead Game UI/UX Designer / Chemistry Visualization Developer / Frontend Integration Developer / Web Laboratory Interface Developer
- Current phase: Phase 3B reversible / equilibrium UI
- Overall state: **BLOCKED — authoritative Phase 3B 01/02 provider contract is not yet implemented/stable**
- Last updated: 2026-09-12
- Latest audited main: `e49b3f25eeb39d08a6c397c4869beceb6c5c8bbf`
- Phase 3B 01 branch discovered: `feature/phase3b-equilibrium-foundation`
- Phase 3B 01 branch HEAD at audit: `e49b3f25eeb39d08a6c397c4869beceb6c5c8bbf` — identical to main, with no Phase 3B implementation commit yet
- 05 blocker branch: `feature/phase3b-equilibrium-ui`

## Phase 3B provider-contract audit

05 audited latest `main`, current integration/provider types, 01 status, 02 status, repository branches, and existing equilibrium-related contracts before changing UI code.

### Latest main
Current production main is `e49b3f25eeb39d08a6c397c4869beceb6c5c8bbf` (`docs(07): record Phase3A production integration PASS`).

### Existing production provider surface
Current production UI/provider contract still exposes only Phase 3A reaction projections:
- `reactionActivity?: ReactionActivityView`
- `reactionEvents: ReactionProgressView[]`
- `reactionDeveloperDiagnostics?: ReactionDeveloperDiagnostics`
- authoritative vessel composition through `snapshot.contents`

The production `Phase3AProviderProjection` exposes only:
- `authoritativeVesselComposition`
- `activeReactionEvents`
- `timelineEvents`

There is currently **no production provider field** for any Phase 3B equilibrium/reversible state such as:
- forward/reverse favored state;
- near-equilibrium state;
- equilibrium-state transition event;
- equilibrium fact/event stable id;
- Q;
- K / K_eq;
- deltaG equilibrium projection;
- equilibrium tolerance/proximity;
- player-facing equilibrium scientific status/confidence;
- developer-only equilibrium diagnostics.

### 01 status
`docs/workstream-status/01-simulation-engine.md` on current main is still Phase 3A multi-step network execution. It explicitly leaves long-horizon equilibrium/network acceleration OPEN. Existing provider facts are Phase 3A composition/reaction history only.

### 02 status
`docs/workstream-status/02-thermodynamics-kinetics.md` on current main is still Phase 3A network kinetics / aggregate thermal coupling. It explicitly states:
- forward/reverse channels may be independently evaluated;
- detailed balance is opt-in only;
- no automatic equilibrium assumption;
- no `K_eq` is introduced;
- full equilibrium solver / general `K_eq` path / guaranteed detailed balance remain OPEN;
- do not proceed to a full equilibrium solver yet.

### Phase 3B branch state
Repository branch search found `feature/phase3b-equilibrium-foundation`, but its current HEAD is exactly the same commit as latest main (`e49b3f25eeb39d08a6c397c4869beceb6c5c8bbf`). Therefore there is not yet an auditable Phase 3B executable/provider contract on that branch.

## Why UI implementation is blocked

The requested player-facing labels:
- `→ 정반응 우세`
- `← 역반응 우세`
- `⇌ 평형 근접`
- `? 평형 데이터 미확정`

are valid presentation targets **only after** 01/02/provider supplies an authoritative state. 05 will not infer these from:
- forward/reverse event counts;
- consumed/produced amounts;
- reaction rates;
- reaction heat;
- deltaG values;
- vessel composition;
- elapsed time;
- candidate metadata.

Doing so would move equilibrium logic into UI and violate the project authority boundary.

Likewise, 05 will not invent:
- a UI-local equilibrium enum treated as simulation truth;
- local Q/K calculations;
- local deltaG comparison;
- local near-equilibrium tolerance;
- synthetic timeline transitions derived from render history;
- fake numeric Q/K/deltaG fixtures presented as provider facts.

## Required provider contract before 05 resumes

05 can implement Phase 3B immediately once an actual 01/02/provider surface exists. The minimum usable contract should expose an authoritative player-projectable equilibrium fact with stable identity and status semantics. Exact field names remain 01/02 ownership; 05 does not prescribe them as canonical types.

At minimum the provider must make it possible to consume, without recalculation:
- stable reversible/equilibrium fact identity or reaction-pair identity;
- authoritative qualitative state equivalent to forward-favored / reverse-favored / near-equilibrium / indeterminate;
- simulation time/timestep ordering;
- scientific status using the existing canonical status vocabulary;
- optional numeric Q/K/deltaG only when 02 explicitly supports/exposes them;
- a stable transition/event identity or authoritative transition stream for Timeline de-duplication;
- species references that still pass through the existing opaque player-knowledge projection;
- optional developer diagnostics separated from normal player projection.

## Planned UI projection once unblocked

No implementation has been committed because doing so now would fabricate state. The intended UI shape remains:
- compact equilibrium badge/state inside the existing `반응 활동` strip;
- small equilibrium section in the existing inspector;
- Timeline entries only from authoritative meaningful provider transitions;
- no large equilibrium dashboard;
- no loss of clean central vessel prominence;
- no changes to catalog/condition collapse, T/P/V summary, structural notation, notes, or responsive layout.

Numeric honesty policy will remain:
- `VERIFIED`: provider numeric may display normally;
- `APPROXIMATED`: visibly mark `≈` / approximation;
- `OPEN`: no fabricated exact Q/K/deltaG.

Unknown-species privacy will remain unchanged:
- normal mode never renders internal SpeciesId, hidden formula/graph/reference identity, or candidateId;
- Developer Mode may expose diagnostics only through a separate developer surface.

## Tests queued for implementation

Once the provider contract exists, 05 will add semantic-region-scoped tests for:
- forward-favored state;
- reverse-favored state;
- near-equilibrium state;
- OPEN/indeterminate state;
- approximate numeric-detail honesty;
- unknown identity no-leak;
- Developer Mode diagnostic separation if supplied;
- no duplicate Timeline spam;
- deterministic provider event ordering;
- catalog-collapse regression;
- condition-collapse/T/P/V regression;
- Workbench/reaction-activity regression;
- responsive smoke at 1536×900, 1440×900, 1024×768, 390×844;
- no horizontal overflow / blocking console or page errors.

## Previous completed phase

Phase 3A reaction activity UI is already integrated on main. Its key authority boundary remains the baseline for Phase 3B: UI projects provider facts and player-knowledge identity only; it never recalculates chemistry.

## Gate

**BLOCKED — provider contract not stable.**

Do not add Phase 3B equilibrium badges, numeric Q/K/deltaG, or Timeline equilibrium transitions until actual 01/02/provider fields are committed and auditable.