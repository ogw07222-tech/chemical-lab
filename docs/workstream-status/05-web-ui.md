# 05 — Web UI

- Owner: Lead Game UI/UX Designer / Chemistry Visualization Developer / Frontend Integration Developer / Web Laboratory Interface Developer
- Current phase: Phase 3A reaction activity UI
- Overall state: PASS — UI implementation validated; stacked integration depends on PR #46
- Last updated: 2026-09-12
- Authoritative main at start: `3055ce6d2229806f4560a220ca835fb4b7f7c303`
- Workbench authority: PR #44 merged clean Workbench
- Upstream dependency: PR #46 — `feat(sim): add Phase 3A multi-step reaction network execution`
- Exact PR #46 HEAD used: `6d04b9aa96bfce02717cb9a233ded33d29960132`
- Active stacked branch: `feature/phase3a-reaction-activity-ui`
- Validated code HEAD: `b149bf67b8f26a9e5440c0cb7fed68761039ca30`
- Runtime validation run: `34671192525`

## PR #46 provider-contract audit
05 inspected the actual source at PR #46 HEAD rather than relying on expected names.

Actual provider-facing contract is `Phase3AProviderProjection` from `src/integration/phase3a-reaction-network.ts`:
- `authoritativeVesselComposition: readonly VesselCompositionProjection[]`
- `activeReactionEvents: readonly ReactionFactProjection[]`
- `timelineEvents: readonly ReactionFactProjection[]`

Actual vessel fact fields consumed:
- `speciesRef`
- `amountMol`
- `phase`
- `phaseStateId`

Actual reaction fact fields consumed:
- `eventId`
- `timestepId`
- `sequence`
- `candidateId`
- `startTimeS`
- `endTimeS`
- `consumed[] { speciesRef, amountMol }`
- `produced[] { speciesRef, amountMol }`
- optional `reactionHeat_J`
- `scientificStatus`
- `reasonCodes`

`extentMol` exists upstream but is intentionally not projected into the current player UI. React does not use it to calculate amounts, rates, heat, progress, or reaction equations.

Important ordering fact: PR #46 `sequence` is deterministic inside each timestep and can restart at zero on the next timestep. 05 therefore preserves it as `sourceSequence` for event detail but does not treat it as a cross-timestep global sequence. The UI preserves the authoritative order of `timelineEvents` after stable `eventId` de-duplication.

## Player-knowledge / unknown identity boundary
PR #46 explicitly exposes `speciesRef` as an internal/opaque simulation reference. It is not a player identity.

The adapter requires a `PlayerSpeciesKnowledgeResolver` before any vessel/reaction fact reaches normal UI presentation. The resolver supplies only:
- stable player-facing `unknownRef`
- display label
- identity-confirmed flag
- optional known catalog species id after confirmation

Normal mode does not render:
- internal `speciesRef`
- hidden canonical key
- hidden molecular formula
- hidden molecular graph
- hidden scientific-reference identity
- reaction `candidateId`

Existing generated-species knowledge remains the intended authority for the production resolver. Developer diagnostics are carried in a separate DTO and are emitted only when Developer Mode is enabled.

## UI implementation
The clean PR #44 Workbench remains visually authoritative. No dashboard conversion or new large reaction surface was introduced.

Implemented:
- current authoritative multi-species vessel composition in the primary vessel;
- compact `반응 활동` strip using the existing observation-strip visual language;
- existing Timeline enriched with provider reaction events;
- generic event-derived `consumed → produced` rendering;
- timestep id and upstream sequence shown as event metadata;
- stable React keys from provider `eventId`;
- duplicate provider deliveries de-duplicated by `eventId` without re-sorting chemistry facts;
- separate Developer Mode diagnostics for internal candidate/species refs.

Preserved unchanged:
- mostly empty central experiment area;
- primary vessel as visual focus;
- collapsible catalog;
- collapsible condition panel;
- T/P/V controls and collapsed summary;
- structural notation;
- persistent inspector and notes;
- desktop/tablet/mobile layout;
- existing Workbench CSS authority.

## Chemistry authority
05 does not calculate or infer:
- reaction candidates;
- stoichiometry;
- reaction extent;
- reaction rate;
- equilibrium;
- reaction heat;
- generated molecular identity;
- phase/gas effects.

The arrow shown in Timeline is presentation only: it joins provider-supplied consumed and produced arrays. It is not an independently derived reaction equation.

## Scientific status / precision behavior
05 reuses the repository canonical status only:
- `VERIFIED`
- `APPROXIMATED`
- `EMPIRICAL`
- `GAMEPLAY_SIMPLIFICATION`
- `OPEN`

No new canonical scientific-status enum was introduced.

Display rules:
- supported numeric facts may display numerically;
- `APPROXIMATED` values are visibly prefixed with `≈`;
- `OPEN` reaction participant amounts are not rendered as exact values;
- heat is displayed numerically only when supplied and not OPEN/missing;
- `MISSING_REACTION_ENTHALPY` or OPEN heat renders `열 데이터 미확정`, never a fabricated `0 J` or an exact value.

PR #46 does not currently expose a dedicated qualitative rate/confidence UI field or a generic phase/gas observable-event collection. 05 therefore does not invent them.

## Mock / adapter validation fixture
`MockLaboratoryProvider` has an opt-in `reaction-network` scenario for UI tests only. The fixture is typed directly as PR #46 `Phase3AProviderProjection`; it is not a separately copied chemistry implementation.

The rendering fixture deliberately includes:
- authoritative vessel composition containing known H2 and one generated unknown;
- timestep 1 / sequence 0 reaction;
- timestep 2 / sequence 0 reaction, proving sequence restart is handled;
- the same opaque unknown reference across the two-step chain;
- one duplicate timeline delivery to validate stable event de-duplication;
- one OPEN event carrying a numeric heat field plus `MISSING_REACTION_ENTHALPY`, proving the player UI suppresses fake numeric heat;
- one APPROXIMATED event, proving amount/heat approximation markers;
- provider confirmation that changes the opaque unknown projection to H2O only after analysis confirmation.

The fixture does not assert that its mocked reaction path is scientifically valid.

## Testing
`tests/ui/LaboratoryWorkspace.test.tsx` now has **21 tests**.

Phase 3A coverage includes:
- authoritative vessel composition;
- latest reaction event/activity;
- deterministic two-step event order across timestep sequence restart;
- unknown identity no-leak in normal mode;
- Developer Mode diagnostics separation;
- OPEN heat exact-number suppression;
- OPEN participant exact-amount suppression;
- APPROXIMATED amount/heat marker;
- duplicate event de-duplication;
- identity reprojection only after provider confirmation;
- T/P simulation authority while reaction UI is visible.

PR #44 regression coverage remains for:
- catalog layout and collapse/restore;
- condition collapse/restore and T/P/V summary;
- structural notation;
- AddSubstance / disposal / mix / stir / pause / reset;
- notes;
- discovery/catalog gating;
- responsive smoke.

Testing Library queries are region-scoped with `within(...)` where duplicate projection text is legitimate.

## Validation
### Initial diagnostic
Exact code HEAD `2e0a597b4aeb6938adbf32cc4886883ac91d974d`, run `34671055636`:
- install: PASS
- typecheck: FAIL — UI adapter optional heat narrowing (`TS18048`)

The fix stored/narrowed `reactionHeat_J` before formatting. No chemistry or behavior semantics changed.

### Full-repository lint interaction
Exact code HEAD `b149bf67b8f26a9e5440c0cb7fed68761039ca30`, run `34671108976`:
- install: PASS
- typecheck: PASS
- full `npm run lint`: blocked by an inherited PR #46 error in `src/integration/phase3a-reaction-network.ts` (`_amountToleranceMol` unused)
- UI code additionally emitted one non-blocking React hook dependency warning in the mock provider

The inherited PR #46 lint error is outside the 05 UI diff. 05 did not modify/copy the upstream reaction-network implementation merely to make the stacked branch green.

### UI + stacked runtime validation — PASS
Exact validated code HEAD: `b149bf67b8f26a9e5440c0cb7fed68761039ca30`
Diagnostic run: `34671192525`

- `npm ci --no-audit --no-fund`: PASS
- `npm run typecheck`: PASS
- UI-scoped ESLint (`src/ui`, `tests/ui`): PASS with 0 errors / 1 non-blocking hook dependency warning
- targeted UI tests: **21/21 PASS**
- full test suite: **205/205 PASS across 17 files**
  - PR #46 `tests/phase3a-reaction-network.test.ts`: **11/11 PASS**
- production build: PASS
- Chromium install: PASS
- browser smoke: PASS
  - Desktop 1536×900
  - Desktop 1440×900
  - Tablet 1024×768
  - Mobile 390×844
- horizontal overflow regression: PASS through existing smoke
- catalog/condition collapse regression: PASS
- central Workbench remains usable and reaction activity remains a compact secondary strip
- blocking page/console errors: none reported by smoke

## Integration strategy
This branch is stacked directly on exact PR #46 HEAD. It does not copy the PR #46 implementation into an independent main-based UI branch.

Dedicated UI PR should target `feature/phase3a-reaction-network` while #46 is open. After #46 lands and Phase 3A stack validation is complete, the UI PR can be retargeted/rebased onto current main by integration ownership.

Do not merge this UI PR independently before the Phase 3A stack is validated.

## Open integration items
- PR #46 full-repository lint error must be resolved upstream before the stacked integration can obtain an all-repository lint PASS.
- Production Game Layer/provider wiring must supply the real player-knowledge resolver rather than the UI test fixture resolver.
- Dedicated qualitative rate/confidence text should be added only if 02/provider exposes that authoritative projection.
- Phase/gas observable Timeline entries should be added only if provider/simulation exposes corresponding facts.

## Gate
**PASS — Phase 3A reaction activity UI implemented against authoritative PR #46 provider state.**

The UI implementation itself is validated. Merge remains intentionally deferred because this is a stacked PR dependent on #46 and #46 currently owns an inherited full-repository lint blocker.
