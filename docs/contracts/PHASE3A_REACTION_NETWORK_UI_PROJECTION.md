# Phase 3A — Reaction Network UI Projection

Status: 05 CONTRACT / MINIMAL IMPLEMENTATION
Owner: 05 — Web UI
Upstream owners: 01 — Chemistry Simulation Engine, 02 — Thermodynamics & Kinetics

## Purpose

Project authoritative multi-step reaction-network state into the existing clean laboratory workbench without duplicating chemistry logic, fabricating numerical precision, or exposing undiscovered species identity.

The UI remains a projection layer:

`01/02 simulation facts -> provider / Game Layer knowledge projection -> 05 view models -> React rendering`

React does not generate candidates, solve stoichiometry, calculate rates, infer equilibrium, calculate reaction heat, resolve phase truth, or infer generated-species identity.

## Layout Contract

Phase 3A does not turn the central workbench into a dashboard.

Preserve:
- clean, mostly empty central experiment area;
- primary vessel as the visual focus;
- subtle grid / wall / counter;
- collapsible catalog;
- collapsible conditions panel;
- structural notation for known catalog species;
- existing inspector;
- existing analysis drawer / Timeline;
- responsive desktop, tablet, and mobile behavior.

New persistent information is limited to a compact reaction-activity strip between the vessel area and analysis drawer. Detailed multi-step history belongs in Timeline.

## Upstream 01 Fact Mapping

01 Phase 3A exposes authoritative simulation facts through `Phase3AProviderProjection`:
- `authoritativeVesselComposition`;
- `activeReactionEvents`;
- append-only `timelineEvents`.

01 reaction facts contain event id, timestep id, per-timestep deterministic sequence, start/end simulation time, consumed/produced species refs and mol amounts, optional reaction heat, scientific status, and reason codes.

05 must not render 01 `speciesRef` directly. It is an internal simulation reference, not a player-facing identity.

### Vessel composition

Provider adapter maps each 01 vessel fact to a player-safe `VesselContentView`:
- finite authoritative `amountMol` copied from simulation;
- authoritative phase copied from simulation/phase integration;
- known identity only when Game Layer knowledge permits it;
- otherwise an opaque player-facing label such as `Unknown α`;
- internal `speciesRef`, hidden formula, name, graph, and generated identity remain outside normal UI projection.

### Reaction events

Provider adapter maps 01 `ReactionFactProjection` to `ReactionProgressProjection`.

Required fields for 05:
- `id`;
- provider-global `timelineOrder`;
- `timestepId`;
- `sourceSequence` preserving 01 per-timestep event sequence;
- `startTimeS` / `endTimeS`;
- UI `stepIndex` for event-history presentation;
- state/activity label supplied by provider;
- display precision classification supplied by provider;
- scientific status and confidence supplied by 01/02 adapter;
- player-safe consumed/produced projections;
- optional reaction-heat projection;
- optional observable effects already resolved upstream.

`sourceSequence` is not a global timeline key. 01 restarts sequence within a timestep. If command, observation, discovery, and reaction events share one UI Timeline, the provider must assign one monotonically increasing `timelineOrder` after authoritative history reconciliation. React only sorts by that supplied key.

## Multi-step Presentation

Timeline may render:

`Step N · A + B -> Unknown α`

followed by:

`Step N+1 · Unknown α + C -> Y`

only when those entries already exist in provider event history.

The arrow and participant grouping are presentation of supplied consumed/produced arrays. They are not a reaction solver or a hardcoded reaction diagram.

The UI does not infer causal links by molecular identity, graph structure, candidate ids, or stoichiometry. Cross-step continuity is established only by provider history/order and player-safe references.

## Unknown Species Privacy

Normal mode rules:
- never render internal `SpeciesId` / `speciesRef`;
- never render hidden name, formula, graph, candidate-derived identity, or registry internals;
- use provider-supplied opaque label only;
- unknown labels may persist across vessel and timeline projections through an opaque reference controlled upstream;
- discovery confirmation is the only transition that may replace an opaque player-facing label with known identity.

The UI includes an additional presentation guard: when `identityConfirmed` is false it ignores `displayIdentity` and renders only `opaqueLabel` or the generic `Unknown substance` fallback.

Developer Mode may receive a separate diagnostics DTO in future. Normal player DTOs are not widened to expose hidden identity merely because Developer Mode exists.

## Precision and Scientific Status

05 consumes 02-derived classification; React does not derive it from numerical values.

`ReactionDisplayPrecision`:
- `KNOWN`: numeric player-facing quantities may be rendered when the provider explicitly supplies them;
- `APPROXIMATED`: numeric quantities require an approximation marker such as `≈`;
- `OPEN`: do not render a quantity as exact merely because an internal number exists; prefer qualitative text such as `반응 진행 감지`, `속도 데이터 미확정`, or `정밀도 미확정`.

This display classification is separate from 02 scientific taxonomy:
- `VERIFIED`;
- `APPROXIMATED`;
- `EMPIRICAL`;
- `GAMEPLAY_SIMPLIFICATION`;
- `OPEN`.

Confidence is also separate:
- `HIGH`;
- `MEDIUM`;
- `LOW`;
- `UNASSESSED`.

For rates:
- dimensioned physical rate may be displayed only when 02/provider explicitly supplies a supported dimensioned value and unit;
- relative-rate scores are not displayed as physical rates;
- qualitative-only support renders class/text only;
- OPEN renders unknown/insufficient, never zero.

The minimal Phase 3A UI does not yet add a dedicated rate-number surface.

## Reaction Heat

React never computes `extent * deltaH`, sign conversion, aggregation, or temperature response.

Provider heat projection may contain:
- supplied numeric heat when known;
- display precision;
- coverage `COMPLETE | PARTIAL | NONE`;
- scientific status/confidence;
- qualitative fallback label.

Rendering rules:
- `KNOWN` + supplied numeric heat: numeric value permitted;
- `APPROXIMATED`: numeric value prefixed with `≈`;
- `OPEN` or unavailable: show provider label such as `반응열 데이터 미확정`, not `0 J`;
- `PARTIAL`: when a numeric known contribution is displayed, mark that only part of the reaction-heat model is represented.

Actual vessel temperature remains the authoritative simulation/provider temperature. UI never converts a displayed reaction heat into a temperature change.

## Phase / Gas Observables

Observable labels are rendered only when supplied by simulation/provider facts, for example:
- gas evolution observed;
- phase transition observed;
- provider-authoritative temperature effect.

05 does not derive an observable from T/P/composition or infer gas production from reaction participants.

01 currently exposes vessel phase in composition projection but its Phase 3A reaction-fact projection does not yet provide a generic observable-effect collection. Until that upstream contract exists, production UI must omit such event detail rather than infer it.

## Compact Reaction Activity Strip

Persistent strip content is intentionally small:
- current/latest provider activity label;
- simulation time;
- display precision marker.

Examples:
- `반응 · 반응 진행 감지 · 2.0s · ≈ 근사`
- `반응 · 감지된 반응 없음 · provider 상태 대기`

No candidate list, network graph, rate table, or chemistry dashboard is added to the main vessel area.

## Inspector

The existing inspector remains species-oriented and knowledge-gated.

Known catalog/encyclopedia species may show known identity and supplied data.
Unknown generated species do not automatically become selectable inspector species merely because they appear in vessel/reaction facts. A future player-knowledge adapter may expose an opaque unknown inspector model, but it must not expose hidden registry identity.

## Mock / Projection Plan

The current mock provider has an opt-in `reaction-network` scenario used only by UI tests.

It supplies already-resolved projection facts:
- multi-species vessel composition;
- two reaction events across two timesteps;
- per-timestep `sourceSequence` restarting at 0;
- provider-global `timelineOrder` 1 then 2;
- one OPEN event with no displayed amount precision;
- one APPROXIMATED event with `≈` amounts;
- one opaque unknown reference reused across steps;
- discovery confirmation that reprojects the opaque reference to known H2O through provider state;
- an upstream-style gas observable label.

The fixture is not chemistry truth and does not claim the mocked reaction path is scientifically valid. It exists to validate rendering/privacy/order contracts.

## Tests

Testing Library queries must assume duplicate text can legitimately appear across vessel, composition table, inspector, catalog, activity strip, and Timeline.

Use semantic region/accessible-label scoping.

Required coverage:
- authoritative current vessel composition;
- reaction activity appears;
- multi-step reaction history order;
- OPEN precision does not expose exact amount;
- APPROXIMATED values carry approximation marker;
- unknown hidden identity does not leak;
- provider discovery confirmation changes player-facing identity;
- T/P remain simulation-authoritative while reaction projection is visible;
- catalog collapse regression;
- condition-panel collapse regression;
- responsive desktop/tablet/mobile smoke;
- no horizontal overflow;
- no blocking console/page errors.

## 01 Dependencies

Production adapter needs 01 Phase 3A facts after integration:
- `authoritativeVesselComposition`;
- `activeReactionEvents`;
- append-only `timelineEvents`;
- event `timestepId`, per-timestep `sequence`, start/end time;
- consumed/produced `speciesRef` + authoritative amount;
- optional reaction heat;
- scientific status/reason codes.

05 must preserve 01 event order; it must not re-rank reactions by candidate id or chemistry properties.

## 02 Dependencies

Production projection needs 02 semantics for:
- supported rate presentation (`DIMENSIONED_RATE / RELATIVE_RATE / QUALITATIVE_ONLY / OPEN`);
- rate class when qualitative display is desired;
- scientific status;
- confidence;
- reaction-heat coverage `COMPLETE / PARTIAL / NONE`;
- partial-model temperature/debug indicators when applicable.

No 02 calculation belongs in React.

## OPEN Items

1. Production adapter: wire merged 01 `Phase3AProviderProjection` into 05 DTOs without exposing `speciesRef` to player UI.
2. Player knowledge adapter: define the authoritative mapping from internal species ref to known identity or stable opaque unknown reference.
3. Unified timeline order: integration layer must assign `timelineOrder` across reaction and non-reaction event domains; 01 `sequence` is only per timestep.
4. Reaction activity state: define the upstream mapping from active events / kinetics semantics to concise activity labels; React must not derive this from event counts or rates.
5. Reaction heat summary: expose 02 coverage/status alongside numeric heat when available.
6. Phase/gas observable events: add an upstream factual observable projection if/when simulation provides it; until then omit rather than infer.
7. Developer diagnostics: if needed, define a separate diagnostic DTO that can expose internal refs without weakening normal-mode privacy.
8. Save/replay: preserve provider-global timeline order across persistence once full experiment history orchestration is implemented.

## Gate

The minimal UI projection is acceptable only if multi-step chemistry activity remains compact, provider-authoritative, privacy-safe, precision-safe, and visually subordinate to the central vessel/workbench.
