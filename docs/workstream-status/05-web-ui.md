# 05 — Web UI

- Owner: Lead Game UI/UX Designer / Chemistry Visualization Developer / Frontend Integration Developer / Web Laboratory Interface Developer
- Current phase: Phase 0 — Runnable PC-first UI scaffold
- Overall state: BLOCKED_BROWSER_SMOKE
- Last updated: 2026-09-11
- Last checked main SHA: `27c32f93eb16d1061959bd02f8cf10bfe502b9f3`
- Active branch: `feature/phase0-web-lab-scaffold`
- Active PR: #4 — `feat(ui): runnable Phase 0 laboratory scaffold`
- Validated implementation HEAD: `ed877eae58afc583158cca5d6b07d5849fa8087f`
- Validation workflow run: `34580511787`

## Current Objective
Keep PR #4 aligned with the current production contracts while keeping chemistry, progression authority, thermal physics, and phase determination outside React. PR #4 is not merge-ready until browser smoke passes.

## Latest main refresh
PR #4 incorporates production main `27c32f93eb16d1061959bd02f8cf10bfe502b9f3`, including the current chemistry data, molecular core, thermal primitives, progression runtime, and validation harness. The refresh commit was `e199cac6d586280bcfbfccb2187e97294c64056a`.

## Fresh targeted failure diagnosis
Original exact PR HEAD under diagnosis: `9a1ba5571417605df4ea903f31717bc0d70b4044`.

Because the existing Actions connector did not expose the assertion body from run `34578933379` / job `103197740831`, a separate diagnostic branch checked out that exact SHA and executed the exact CI command:

`npm test -- tests/ui/LaboratoryWorkspace.test.tsx`

Fresh reproduction result:
- file: `tests/ui/LaboratoryWorkspace.test.tsx`
- 9 tests total; 4 failed / 5 passed
- failure class: stale query/assertion
- no product/provider chemistry bug was demonstrated

Failures:
1. `normal inventory exposes starters but not all supported species`
   - `TestingLibraryElementError`
   - global `getByText('Hydrogen')` expected one element but actual DOM legitimately contained Hydrogen in both Inventory and Molecule Inspector
   - stack: `LaboratoryWorkspace.test.tsx:11:108`
2. `adds a finite amount through the provider`
   - `TestingLibraryElementError`
   - expected visible `/Added 0.250 mol H₂/`; actual active `Composition` tab does not render event messages
   - stack: `LaboratoryWorkspace.test.tsx:13:158`
3. `uses heater power and thermostat commands rather than direct temperature mutation`
   - `TestingLibraryElementError`
   - expected visible `/Thermostat enabled/`; actual event is rendered only in `Timeline`
   - stack: `LaboratoryWorkspace.test.tsx:14:315`
4. `confirms the mock unknown before discovery unlock feedback`
   - `TestingLibraryElementError`
   - expected visible `/Identity confirmed: Water/`; actual discovery event is rendered only in `Timeline`
   - stack: `LaboratoryWorkspace.test.tsx:15:226`

The previous explicit `afterEach(cleanup)` fix remains in place, but this fresh run showed the remaining failures were not residual cross-test DOM leakage.

## Minimal fix
Commit `ed877eae58afc583158cca5d6b07d5849fa8087f` changed only `tests/ui/LaboratoryWorkspace.test.tsx`:
- scoped the Hydrogen starter assertion to the Inventory panel rather than weakening it to a multi-match assertion;
- opened the existing Timeline tab before asserting provider event messages for AddSubstance, thermostat, and discovery.

No product code, provider semantics, chemistry logic, identity secrecy, or progression rules were changed.

## Fresh validation — implementation HEAD `ed877eae58afc583158cca5d6b07d5849fa8087f`
Workflow run `34580511787`:

### PASS
- `npm ci --no-audit --no-fund`
- `npm run typecheck`
- `npm run lint`
- targeted: `npm test -- tests/ui/LaboratoryWorkspace.test.tsx`
  - 1 file passed
  - 9/9 tests passed
  - duration 1.64 s; test execution 636 ms
- full: `npm test`
  - 5 files passed
  - 73/73 tests passed
  - duration 2.99 s
  - includes production progression, thermal, molecular-core, validation-foundation, and UI suites
- `npm run build`
  - Vite production build PASS
  - 32 modules transformed
- Playwright Chromium installation PASS

### FAIL / merge blocker
Browser smoke failed at Desktop before Tablet/Mobile could be accepted:

`Error: desktop: finite amount add failed`

Stack:
- `tools/ui-smoke.mjs:15:61` (`assert`)
- `tools/ui-smoke.mjs:35:3`

Therefore browser smoke is the exact remaining merge gate. No browser-smoke fix is claimed in this targeted-failure task.

## Contract audit
### Progression — PASS by source/test audit
- normal inventory is starter-only in the UI fixture;
- locked species are hidden from normal selection;
- unconfirmed observation identity is not stored in the UI-facing snapshot;
- analysis confirmation precedes discovery/inventory unlock;
- encyclopedia and inventory unlock are updated together in the mock adapter;
- unlocked inventory is presented as unlimited stock while each vessel add requires finite positive `amountMol`;
- Developer Mode is isolated as an explicit access bypass;
- current production `src/game/progression.ts` explicitly ignores Premium for access and enforces discovery/encyclopedia/inventory invariants.

### Thermal — PASS by source/test audit
- heater and cooler controls dispatch power requests in W;
- thermostat dispatches enabled/target-K controller requests;
- there is no direct `SetTemperature` command in the UI boundary;
- displayed temperature comes from provider snapshot state;
- React contains no heat-capacity, reaction-enthalpy, or temperature-evolution calculation.

### Phase — PASS by source audit
- no manual phase selector exists;
- vessel phase is supplied through provider snapshot content;
- React does not derive phase from T/P;
- Phase tab renders supplied phase-diagram data only;
- mock phase diagram remains explicitly labeled `UI-only illustrative fixture — not scientific phase data`.

### SI — PASS by source/test audit
Simulation-facing implemented UI boundary preserves K, Pa, m³, mol, and W, with display conversions centralized in `src/ui/units.ts`.

## Current blocker
`BLOCKED`: browser smoke on the validated implementation HEAD fails at the Desktop finite-add check. Because Desktop smoke did not pass, Tablet/Mobile responsive smoke cannot be marked PASS and PR #4 is not ready for merge.

## Next action
Diagnose `tools/ui-smoke.mjs` Desktop finite-add assertion against the actual rendered UI/provider behavior, make only the smallest evidence-based fix, then rerun the complete gate on the resulting exact HEAD.

## Handoff to 07
Do not merge PR #4 yet. Runtime unit/type/lint/build gates are green on implementation HEAD `ed877eae58afc583158cca5d6b07d5849fa8087f`, but browser smoke remains FAIL (`desktop: finite amount add failed`).
