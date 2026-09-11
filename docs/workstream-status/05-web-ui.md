# 05 — Web UI

- Owner: Lead Game UI/UX Designer / Chemistry Visualization Developer / Frontend Integration Developer / Web Laboratory Interface Developer
- Current phase: Laboratory workbench visual redesign
- Overall state: PASS
- Last updated: 2026-09-11
- Starting main: `fb1b1ed4605eca26745629d82812e216a139cc0c`
- Active branch: `feature/lab-ui-workbench-redesign`
- Active PR: #34 — `feat(ui): redesign laboratory as clean workbench`
- Validated implementation HEAD: `0b7281cc592431afcb345a19d31b135f85f2c991`
- Validation run: `34606112975`

## Objective
Replace the prior dark card/SaaS dashboard visual language with a clean, compact, desktop-first digital chemistry laboratory workbench while preserving simulation/Game Layer authority and existing progression/security boundaries.

## Redesign scope
- Three-column desktop composition: 도감 / laboratory workbench / persistent substance inspector.
- Full-width bottom experiment console for conditions, operations, and disposal.
- Thin CHEM LAB header with experiment/status controls.
- Off-white/light-gray surfaces, subtle scientific grid, thin outlines, restrained shadows, dense technical hierarchy.
- Central laboratory wall and counter rendered with lightweight CSS/DOM instrument shapes: primary beaker, secondary beaker, test-tube rack, stirrer/hotplate body, clamp stand, bottle.
- Removed dashboard-card visual language, dark blue AI-style gradients, floating pill controls, and oversized empty panels.

## Functional changes
### 도감
- UI naming changed from Inventory/Materials to `도감`.
- Search + 전체 / 원소 / 화합물 / 즐겨찾기 filters.
- Compact row list with preview, Korean/common display name, formula, favorite, selected state.
- Add amount control integrated at catalog bottom.
- normal access still comes from provider selectors; Developer Mode remains explicit QA bypass.

### AddSubstance
- finite positive amount only.
- UI unit is mol and provider command remains finite `amountMol`.
- no chemistry/progression truth is recreated in React.

### Substance Inspector / notebook feel
- persistent `물질 정보` / `내 메모` tabs.
- technical reference-sheet layout with faint ruled/grid background.
- authoritative properties shown only when provider/encyclopedia data exists; unavailable data remains explicitly unavailable.
- My Notes is a free-form UI draft surface only. No automatic truth classification or chemistry interpretation.

### Experiment conditions
- temperature, pressure, volume use dense numeric + slider rows.
- temperature UI maps to `SetThermostat` target request; actual `snapshot.temperatureK` remains provider-owned.
- pressure UI maps to a controller-style `SetPressureTarget` request; actual `snapshot.pressurePa` remains provider-owned.
- volume continues through `ChangeVolume` in SI m³.
- dedicated heater/cooler buttons are removed from the workbench surface.

### Operations / disposal
- compact rectangular controls: 혼합 / 교반 / 반응 정지 / 초기화.
- Mix/Stir are provider-bound mock request events only; no chemistry is calculated in React.
- `폐기` uses typed `RemoveSubstance` provider command and lightweight confirmation; React local state never directly deletes vessel contents.

## Science / architecture boundaries
- UI -> provider/state/selectors only.
- no reaction feasibility, stoichiometry, products, phase truth, thermodynamics, kinetics, molar-mass calculation, or notebook truth evaluation in React.
- no direct SetTemperature command.
- no direct pressure overwrite.
- phase renderer consumes supplied provider data only.
- undiscovered identity remains hidden before analysis confirmation.

## Responsive direction
- Desktop: 3-column workbench + full-width bottom console.
- Tablet: catalog + central workspace first, inspector beneath, console readable.
- Mobile: bottom navigation `도감 / 실험실 / 정보 / 조작 / 메모`; single-surface views prevent horizontal overflow.

## Validation — PASS
Exact validated implementation HEAD: `0b7281cc592431afcb345a19d31b135f85f2c991`
Workflow run: `34606112975`

- `npm ci --no-audit --no-fund`: PASS
- `npm run typecheck`: PASS
- `npm run lint`: PASS
- targeted UI: 10/10 PASS
- full `npm test`: 127/127 PASS across 11 files
- `npm run build`: PASS
- Chromium install: PASS
- browser smoke: PASS
  - Desktop: 1536×900, 1440×900
  - Tablet: 1024×768
  - Mobile: 390×844
- no horizontal overflow: PASS
- catalog access/search/filter surface: PASS
- finite AddSubstance: PASS
- temperature target without direct temperature teleport: PASS
- pressure target without direct pressure overwrite: PASS
- Mix/Stir provider events: PASS
- phase supplied-data renderer: PASS
- free-form My Notes: PASS
- discovery/encyclopedia/catalog unlock: PASS
- Developer Mode isolation: PASS
- provider-backed disposal + confirmation: PASS
- blocking console/page errors: none

## Gate
**PASS** — implementation validation is green. The status-only documentation commit after the validated implementation HEAD does not alter runtime code or test logic.
