# 05 — Web UI

- Owner: Lead Game UI/UX Designer / Chemistry Visualization Developer / Frontend Integration Developer / Web Laboratory Interface Developer
- Current phase: Phase 0 — Runnable PC-first UI scaffold
- Overall state: FINAL_VALIDATION_PENDING
- Last updated: 2026-09-11
- Last checked production base: `27c32f93eb16d1061959bd02f8cf10bfe502b9f3`
- Active branch: `feature/phase0-web-lab-scaffold`
- Active PR: #4 — `feat(ui): runnable Phase 0 laboratory scaffold`
- Latest fully validated implementation HEAD before this status-only commit: `72ab6f436f04cb56f13ae40fbdfef0898c071ce9`
- Latest full validation run: `34588150849`

## Current Objective
Keep PR #4 aligned with the canonical PC-first laboratory UI while chemistry, progression authority, thermal physics, and phase determination remain outside React. All implementation/runtime gates passed on `72ab6f436f04cb56f13ae40fbdfef0898c071ce9`; one final full validation must include this status-document commit before the PR can be declared merge-ready.

## Thermostat browser-smoke diagnosis
Original blocker on exact PR HEAD `c8a50dba3d976cb7cbf8d30d14dec4f296f8172a`:

`Error: desktop: thermostat command feedback missing`

Classification: **B. SMOKE SCRIPT BUG**.

A diagnostic workflow checked out the exact failing HEAD and reproduced the Desktop thermostat interaction under Node 22 / Playwright Chromium.

### Exact controls and state
- thermostat toggle: `getByRole('checkbox', { name: 'Thermostat' })`
- target input: `getByRole('spinbutton', { name: 'Thermostat target' })`
- initial target: `25` °C
- requested target: `37` °C
- initial checkbox: unchecked
- initial vessel temperature: `298.1 K / 25.0 °C`

### Observed behavior
After entering `37` °C and blurring the target input:
- target remained `37` °C;
- thermostat remained disabled;
- vessel temperature remained `298.1 K / 25.0 °C`.

After enabling thermostat:
- checkbox reflected enabled state from provider snapshot;
- target remained `37` °C;
- vessel temperature still remained `298.1 K / 25.0 °C`;
- `Thermostat enabled` was not visible while the active analysis tab was not Timeline;
- after explicitly opening Timeline, `Thermostat enabled` was present.

After disabling thermostat:
- checkbox reflected disabled state;
- target remained `37` °C;
- vessel temperature remained unchanged;
- Timeline contained `Thermostat disabled`.

Browser console/page errors: none.

Source audit confirms the UI dispatches `SetThermostat` with `targetTemperatureK: celsiusToKelvin(targetC)`, and the mock provider updates only `controls.thermostatEnabled` and `controls.thermostatTargetK`. It does not overwrite `snapshot.temperatureK` and there is no direct `SetTemperature` UI command.

Therefore the product/provider behavior was correct. The failing smoke assertion incorrectly searched for a Timeline-only provider event while another analysis tab was active.

## Thermostat smoke fix
Commit `373640bf9c5bf92a1770f637e4d78135976171a0` changed only `tools/ui-smoke.mjs`.

The thermostat smoke now proves:
- target input accepts and retains `37` °C;
- changing target does not directly change vessel temperature;
- enabling thermostat is reflected in provider-derived checkbox state;
- enabling does not directly change vessel temperature;
- Timeline explicitly contains `Thermostat enabled`;
- disabling thermostat is reflected in provider-derived state;
- Timeline explicitly contains `Thermostat disabled`;
- disabling also does not directly change vessel temperature.

A dedicated Desktop thermostat smoke run (`34588044887`) passed on exact implementation HEAD `373640bf9c5bf92a1770f637e4d78135976171a0`.

## Next stale smoke assertion discovered and fixed
The first full run after the thermostat fix advanced past the thermostat gate and exposed:

`Error: desktop: discovery confirmation missing`

at `tools/ui-smoke.mjs:79:3`.

This was also a stale smoke assertion: `Identity confirmed: Water` is a provider event rendered in Timeline, while the product unlock itself is visible directly as Water becoming available after Analyze. Existing component tests already exercised the same Timeline contract.

Commit `72ab6f436f04cb56f13ae40fbdfef0898c071ce9` changed only the smoke sequence so that it:
- verifies Water appears after Analyze, proving encyclopedia/inventory unlock;
- explicitly opens Timeline;
- then requires `Identity confirmed: Water`.

No product/provider chemistry or progression semantics changed.

## Full checkpoint — exact implementation HEAD `72ab6f436f04cb56f13ae40fbdfef0898c071ce9`
Workflow run `34588150849` / job `103227017498`:

### PASS
- `npm ci --no-audit --no-fund`
- `npm run typecheck`
- `npm run lint`
- targeted UI: `tests/ui/LaboratoryWorkspace.test.tsx` — 9/9 PASS, total duration 1.64 s
- full `npm test` — 5 files / 73/73 PASS, total duration 3.05 s
- `npm run build` — PASS, Vite 7.3.6, 32 modules transformed
- Chromium installation — PASS
- full browser smoke — PASS
- tested commit step — `72ab6f436f04cb56f13ae40fbdfef0898c071ce9`

Browser smoke output:

`UI browser smoke PASS: desktop 1440x900, tablet 1024x768, mobile 390x844`

### Browser coverage verified
Desktop:
- app loads without blocking console/page errors;
- starter-only normal inventory and undiscovered identity secrecy;
- finite AddSubstance changes Composition and vessel projection to H₂ `0.250 mol`;
- unlimited unlocked stock semantics remain visible;
- heater and cooler controls;
- thermostat target/request, enable/disable state, Timeline acceptance, and no direct temperature teleport;
- Phase tab and supplied phase diagram fixture;
- Run/Pause;
- Unknown observation Analyze -> Water unlock -> Timeline confirmation;
- Developer Mode exposes additional supported species only when enabled;
- no horizontal overflow.

Tablet (~1024 px):
- core laboratory surfaces render;
- no horizontal overflow.

Mobile (390×844):
- Lab view prioritizes vessel;
- Inventory / Lab / Controls / Analysis / Log responsive navigation works;
- expected surface content appears in each view;
- no horizontal overflow.

## Final contract audit
### Progression — PASS
- starter-only normal inventory;
- undiscovered identity remains secret before confirmation;
- confirmation precedes unlock;
- discovery/inventory/encyclopedia authority remains provider/Game Layer owned;
- unlocked stock is unlimited while every vessel addition carries a finite positive `amountMol`;
- Developer Mode remains an explicit isolated QA bypass.

### Thermal — PASS
- heater/cooler are power requests in W;
- thermostat is enabled/target-K controller request only;
- target °C is converted at the UI boundary with `celsiusToKelvin`;
- no direct `SetTemperature` behavior exists;
- displayed actual temperature remains provider-owned;
- thermostat requests do not teleport actual vessel temperature;
- no thermal physics is implemented in React.

### Phase — PASS
- no manual phase selector;
- provider snapshot owns phase;
- phase diagram is renderer-only over supplied data;
- no UI-side T/P -> phase calculation.

### SI — PASS
Simulation-facing implemented UI boundary preserves K, Pa, m³, mol, and W, with presentation conversions centralized in `src/ui/units.ts`.

## Current gate
Implementation/runtime validation is fully green on `72ab6f436f04cb56f13ae40fbdfef0898c071ce9`. This status update changes PR HEAD, so one final full workflow run on the resulting exact HEAD is required before changing the overall state to READY_FOR_MERGE.

## Handoff to 07
Do not merge until the status-document-inclusive exact HEAD completes one final full workflow with install, typecheck, lint, tests, build, and Desktop/Tablet/Mobile browser smoke all PASS. If that run is green and PR remains mergeable against current main, PR #4 may be handed off as ready for immediate merge.
