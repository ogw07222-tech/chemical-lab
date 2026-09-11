# 05 — Web UI

- Owner: Lead Game UI/UX Designer / Chemistry Visualization Developer / Frontend Integration Developer / Web Laboratory Interface Developer
- Current phase: Phase 0 — Runnable PC-first UI scaffold
- Overall state: READY_FOR_MERGE
- Last updated: 2026-09-11
- Last checked production base: `27c32f93eb16d1061959bd02f8cf10bfe502b9f3`
- Active branch: `feature/phase0-web-lab-scaffold`
- Active PR: #4 — `feat(ui): runnable Phase 0 laboratory scaffold`
- Latest fully validated status-inclusive HEAD before this final status marker: `b513b3c56cfd1e3224e809ae18fdce1bb62d59b4`
- Final validation run: `34588354130`

## Current Objective
PR #4 has satisfied the Phase 0 Web UI runtime gate. Chemistry, progression authority, thermal physics, and phase determination remain outside React. The branch is ready for integration provided this final status-marker commit also remains green and GitHub still reports the PR mergeable against current main.

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

## Full checkpoint — implementation HEAD `72ab6f436f04cb56f13ae40fbdfef0898c071ce9`
Workflow run `34588150849` / job `103227017498` passed install, typecheck, lint, targeted UI 9/9, full tests 73/73, production build, Chromium installation, and full Desktop/Tablet/Mobile browser smoke.

## Final status-inclusive checkpoint — HEAD `b513b3c56cfd1e3224e809ae18fdce1bb62d59b4`
Workflow run `34588354130` completed successfully with every gate green:
- `npm ci --no-audit --no-fund` — PASS
- `npm run typecheck` — PASS
- `npm run lint` — PASS
- targeted UI `tests/ui/LaboratoryWorkspace.test.tsx` — PASS
- full `npm test` — PASS
- `npm run build` — PASS
- Chromium installation — PASS
- full browser smoke — PASS
- tested-commit step — PASS

Browser smoke covers Desktop 1440×900, Tablet ~1024 px, and Mobile 390×844, including finite AddSubstance, unlimited unlocked inventory semantics, heater/cooler, thermostat requests without direct temperature teleport, Run/Pause, Phase, unknown observation analysis, discovery/unlock, Developer Mode isolation, responsive navigation, overflow checks, and blocking console/page error detection.

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
**READY_FOR_MERGE**. All implementation/runtime/browser and contract gates have passed. The final status-marker commit is documentation-only; its branch-triggered verification must remain green before integration.

## Handoff to 07
PR #4 is approved by 05 for immediate merge once GitHub confirms the current exact branch HEAD is green and `mergeable=true` against current main. No Web UI blocker remains.
