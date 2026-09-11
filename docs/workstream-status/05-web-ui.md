# 05 — Web UI

- Owner: Lead Game UI/UX Designer / Chemistry Visualization Developer / Frontend Integration Developer / Web Laboratory Interface Developer
- Current phase: Phase 0 — Runnable PC-first UI scaffold
- Overall state: BLOCKED_BROWSER_SMOKE
- Last updated: 2026-09-11
- Last checked production base: `27c32f93eb16d1061959bd02f8cf10bfe502b9f3`
- Active branch: `feature/phase0-web-lab-scaffold`
- Active PR: #4 — `feat(ui): runnable Phase 0 laboratory scaffold`
- Latest validated implementation HEAD before this status-only commit: `0b01c7f3adb0ac162bf57894ca3381f44a7e2be9`
- Latest full validation run: `34581688772`

## Current Objective
Keep PR #4 aligned with the canonical PC-first laboratory UI while chemistry, progression authority, thermal physics, and phase determination remain outside React. PR #4 is not merge-ready until the complete browser smoke passes.

## Targeted UI regression resolved
The earlier component-test failure was diagnosed on exact historical HEAD and fixed without changing product semantics. Current lineage continues to pass:
- targeted `tests/ui/LaboratoryWorkspace.test.tsx`: 9/9;
- full test suite: 73/73.

## Finite-add browser blocker diagnosis
Original browser blocker on exact HEAD `4e458264dbf1eaa8bf241363b57242b752b48c09`:

`Error: desktop: finite amount add failed`

Classification: **SMOKE SCRIPT BUG**, not a product/provider bug.

A diagnostic workflow checked out that exact HEAD and reproduced the Desktop interaction under the same Node/Playwright/Chromium class of environment as CI.

### Before Add
- selected/default starter: Hydrogen / H₂;
- amount input selector: `getByLabel('Amount')`;
- amount value: `0.25` mol;
- amount is finite and > 0;
- Add selector: `getByRole('button', { name: /Add H₂ to vessel/i })`;
- Add button count: 1;
- Add button disabled: false;
- Composition: `No vessel contents.`;
- no `Added 0.250 mol H₂` event text visible on the active Composition tab.

### After Add
- Composition row: `H₂ / unknown / 0.250 mol`;
- vessel chip: `H₂ / 0.250 mol · Current phase: unknown`;
- empty-vessel projection disappears;
- amount input remains finite `0.25`;
- browser console/page errors: none;
- opening Timeline exposes the provider event exactly once: `Added 0.250 mol H₂`.

Therefore the click fired, the mock provider accepted a finite positive `amountMol`, authoritative UI state changed, and the failure came solely from checking a Timeline-only event string while Composition remained active.

## Finite-add smoke fix
Commit `45cd2b23debff583ef49eb9ebfdf477395261b3d` changed only `tools/ui-smoke.mjs`.

The finite-add smoke now requires all of the following:
- amount input equals finite `0.25` mol;
- Add button is enabled;
- after click, Composition contains `H₂`, `unknown`, and `0.250 mol`;
- vessel projection contains H₂ and `0.250 mol`.

The criterion was not weakened to a click-only check. No product code, provider behavior, chemistry logic, progression semantics, or finite-amount invariant changed.

A dedicated Desktop-only rerun on that fixed HEAD passed.

## Subsequent browser-smoke selector fix
The next full smoke run reached the thermostat interaction and exposed a separate strict-locator problem:

`getByLabel('Thermostat')` matched both the checkbox and `Thermostat target` input.

Commit `0b01c7f3adb0ac162bf57894ca3381f44a7e2be9` narrowed only the smoke selector to:

`getByRole('checkbox', { name: 'Thermostat' })`

No product code changed.

## Fresh full checkpoint — implementation HEAD `0b01c7f3adb0ac162bf57894ca3381f44a7e2be9`
Workflow run `34581688772`:

### PASS
- `npm ci --no-audit --no-fund`
- `npm run typecheck`
- `npm run lint`
- targeted UI: 9/9 PASS
- full `npm test`: 73/73 PASS
- `npm run build`: PASS
- Chromium installation: PASS
- Desktop finite-add state transition: PASS

### Current browser-smoke blocker
Browser smoke proceeds beyond finite-add and the thermostat locator, then fails with:

`Error: desktop: thermostat command feedback missing`

Stack:
- `tools/ui-smoke.mjs:15:61`
- `tools/ui-smoke.mjs:49:3`

The current script checks for visible body text `Thermostat enabled` immediately after checking the thermostat while the active analysis tab is still Composition. Existing component-test evidence shows provider event messages are rendered in Timeline, so this is a new smoke assertion blocker and has not been modified in the finite-add-only task.

Because Desktop smoke terminates here, later Desktop steps plus Tablet/Mobile complete smoke remain OPEN.

## Contract audit
### Progression — PASS
- starter-only normal inventory;
- undiscovered identity secrecy preserved;
- confirmation before discovery/unlock;
- discovery/inventory/encyclopedia authority outside React;
- unlocked stock unlimited while each vessel addition is finite positive mol;
- Developer Mode isolated.

### Thermal — PASS
- heater/cooler are power requests in W;
- thermostat is enabled/target-K request only;
- no direct `SetTemperature` UI command;
- authoritative temperature comes from provider state;
- no thermal physics in React.

### Phase — PASS
- no manual phase selection;
- provider owns phase state;
- phase diagram is supplied-data renderer only;
- no UI-side T/P -> phase calculation.

### SI — PASS
Simulation-facing implemented UI boundary preserves K, Pa, m³, mol, and W with centralized display conversion helpers.

## Current gate
**BLOCKED** — finite-add is fixed and verified, but the next exact browser-smoke blocker is `desktop: thermostat command feedback missing`.

## Next action
A separate follow-up should diagnose the thermostat smoke assertion against the current visible state/Timeline contract before changing it. Do not merge PR #4 until that blocker and the remaining Desktop/Tablet/Mobile smoke gates pass on one final exact HEAD.

## Handoff to 07
Do not merge yet. Finite-add browser behavior is verified and its smoke assertion is fixed, but full browser smoke is still red at the thermostat feedback assertion.
