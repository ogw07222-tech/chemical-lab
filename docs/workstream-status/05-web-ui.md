# 05 — Web UI

- Owner: Lead Game UI/UX Designer / Chemistry Visualization Developer / Frontend Integration Developer / Web Laboratory Interface Developer
- Current phase: Phase 3A Reaction Network UI Projection
- Overall state: PASS / integration dependencies OPEN
- Last updated: 2026-09-12
- Source main: `3055ce6d2229806f4560a220ca835fb4b7f7c303`
- Source layout: PR #44 merged clean workbench
- Active branch: `feature/phase3a-reaction-network-ui`
- Contract: `docs/contracts/PHASE3A_REACTION_NETWORK_UI_PROJECTION.md`
- Initial implementation validation HEAD: `d6adeb3428ac3719ea041f23e9e5c2bf38a5395b`
- Initial validation run: `34669671128`
- Refined contract validation HEAD: `3feb84e2a66d7edde3126655e4644c453ff27e86`
- Refined validation run: `34669959879`

## Objective
Project provider-authoritative multi-step chemistry activity into the existing clean workbench without turning the central vessel area into a dashboard, duplicating chemistry logic, fabricating precision, or leaking hidden generated-species identity.

## UI contract — PASS
`src/ui/types.ts` now defines player-facing reaction projection DTOs distinct from 01 internal engine events:
- `ReactionProgressProjection`
- `ReactionSpeciesProjection`
- `ReactionActivityProjection`
- `ReactionHeatProjection`
- `ReactionObservableProjection`
- `ReactionDisplayPrecision`

The projection keeps separate:
- provider-global `timelineOrder`;
- upstream `timestepId`;
- 01 per-timestep `sourceSequence`;
- start/end simulation time;
- scientific status;
- confidence;
- display precision.

Important ordering correction: 01 sequence is per timestep and can restart. React therefore does not treat source sequence as a global Timeline key. Mixed command/observation/discovery/reaction history is ordered only by provider-supplied `timelineOrder`.

## Minimal implementation — PASS
Current clean-workbench additions are intentionally small:
- primary vessel renders all provider-authoritative current contents;
- unconfirmed content uses opaque unknown label only;
- compact `반응 활동` strip shows latest provider activity/time/precision;
- detailed multi-step history is rendered in the existing Timeline tab;
- Timeline renders generic `Step N · consumed -> produced` from provider arrays only;
- optional heat/observable text is shown only when supplied by provider facts;
- no reaction-network graph/dashboard was added;
- no CSS redesign was required.

PR #44 layout remains intact:
- clean central workspace;
- mostly empty experiment area;
- primary vessel focus;
- collapsible catalog;
- collapsible conditions;
- structural notation;
- persistent inspector;
- responsive desktop/tablet/mobile.

## Unknown species privacy — PASS
Normal UI presentation guard:
- unconfirmed `VesselContentView` ignores `displayIdentity` and renders only `opaqueLabel` or generic `Unknown substance`;
- unconfirmed reaction participant does the same;
- internal SpeciesId/speciesRef is not rendered;
- hidden name/formula/graph is not rendered;
- provider discovery confirmation is required before H2O/other known identity replaces opaque unknown identity.

Mock test data intentionally contains a hidden `displayIdentity` value to prove it does not leak through normal UI.

Developer Mode remains separate; production diagnostics DTO is still an OPEN integration item and does not weaken normal projection privacy.

## Precision — PASS
React consumes, rather than derives, `ReactionDisplayPrecision`:
- `KNOWN`: supplied numeric value may be shown;
- `APPROXIMATED`: supplied numeric amount is marked `≈`;
- `OPEN`: exact amount is suppressed in reaction-step text and qualitative wording is used.

02 scientific status and confidence remain separate from display precision.
Missing/open reaction heat is shown as unknown/unavailable rather than `0 J`. Partial heat coverage is supported by the DTO and is explicitly markable when numeric heat is supplied.

## Mock / projection plan — PASS
`MockLaboratoryProvider` has opt-in scenario `reaction-network` used by tests only.

The fixture supplies already-resolved projection facts; it does not calculate chemistry:
- H2 plus one opaque unknown in vessel composition;
- Step 1 across `mock-step-1` with `sourceSequence = 0`;
- Step 2 across `mock-step-2` with `sourceSequence = 0`;
- global `timelineOrder = 1, 2` proves cross-timestep ordering does not depend on source sequence;
- OPEN Step 1 suppresses fake numeric precision;
- APPROXIMATED Step 2 marks numeric amounts with `≈`;
- one upstream-style gas observable label;
- discovery confirmation reprojects the same opaque reference to known H2O through provider state.

The mock path is explicitly not scientific reaction truth.

## Tests — PASS
`tests/ui/LaboratoryWorkspace.test.tsx` contains 17 tests total.

New Phase 3A coverage:
- current multi-species vessel composition;
- latest reaction activity strip;
- ordered multi-step Timeline events;
- OPEN precision suppresses exact mol display;
- APPROXIMATED values carry `≈`;
- hidden unknown identity does not leak;
- discovery confirmation reprojects unknown to known identity;
- T/P remain simulation-authoritative while reaction state is visible.

Existing regression coverage remains:
- catalog collapse/restore;
- conditions collapse/restore with T/P/V summary;
- provider commands;
- structural notation;
- discovery/catalog progression;
- Developer Mode;
- responsive smoke.

Testing Library assertions use semantic region/accessible-label scope where duplicate text is expected.

## Validation — PASS
Initial implementation checkpoint:
- HEAD: `d6adeb3428ac3719ea041f23e9e5c2bf38a5395b`
- run: `34669671128`
- typecheck: PASS
- lint: PASS
- targeted UI: **17/17 PASS**
- full suite: **190/190 PASS across 16 files**
- build: PASS
- Chromium: PASS
- browser smoke: PASS

Refined contract/order checkpoint:
- HEAD: `3feb84e2a66d7edde3126655e4644c453ff27e86`
- run: `34669959879`
- `npm ci --no-audit --no-fund`: PASS
- typecheck: PASS
- lint: PASS
- targeted UI: **17/17 PASS**
- full suite: **190/190 PASS across 16 files**
- build: PASS
- Chromium: PASS
- browser smoke: PASS
  - Desktop 1536×900 / 1440×900
  - Tablet 1024×768
  - Mobile 390×844
- no horizontal overflow: PASS
- blocking console/page errors: none

## 01 parallel dependency
Inspected `feature/phase3a-reaction-network` while working in parallel.

01 currently defines authoritative Phase 3A facts including:
- authoritative vessel composition;
- active reaction facts;
- append-only reaction timeline;
- timestep id;
- per-timestep deterministic sequence;
- start/end sim time;
- consumed/produced internal species refs + mol;
- optional reaction heat;
- scientific status / reason codes.

05 contract deliberately does not expose the 01 internal `speciesRef` to player UI.

OPEN integration work after 01 lands:
- adapter from 01 `Phase3AProviderProjection` into 05 player-safe DTOs;
- provider-global `timelineOrder` reconciliation with non-reaction events;
- activity label mapping supplied by upstream/Game Layer, not inferred by React.

## 02 parallel dependency
Inspected `feature/phase3a-kinetics-thermal-contract` while working in parallel.

05 contract follows the required separation of:
- scientific status;
- confidence;
- display precision;
- rate support semantics;
- reaction heat coverage.

OPEN integration work after 02 lands:
- expose dimensioned/relative/qualitative/open rate support without pretending relative scores are physical rates;
- expose heat coverage `COMPLETE / PARTIAL / NONE` with supplied heat facts;
- surface partial-model caveats when appropriate.

No Arrhenius/Gibbs/equilibrium/rate/heat computation is implemented in React.

## OPEN items
1. Wire merged 01 network projection through provider/Game Layer adapter.
2. Define authoritative internal species ref -> known identity / stable opaque unknown projection.
3. Define unified provider-global Timeline ordering across reaction and non-reaction event domains.
4. Define upstream reaction activity text/state mapping.
5. Integrate 02 heat coverage/rate support when available.
6. Add provider factual phase/gas observable event contract when simulation exposes it; UI must omit rather than infer meanwhile.
7. Keep Developer Mode diagnostics on a separate diagnostics DTO.
8. Preserve global Timeline ordering through future save/replay.

## Diagnostic workflow note
Diagnostic branches/workflows used for exact-head validation are evidence-only and must not be merged into production:
- `diagnostic/phase3a-ui-projection-d6adeb`
- `diagnostic/phase3a-ui-final-3feb84e`

## Gate
**PASS** — Phase 3A reaction network projection is implemented and validated as a compact provider-authoritative UI layer. Production integration with 01/02 remains explicitly OPEN until their contracts land on main.
