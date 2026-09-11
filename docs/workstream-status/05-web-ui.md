# 05 — Web UI

- Owner: Lead Game UI/UX Designer / Chemistry Visualization Developer / Frontend Integration Developer / Web Laboratory Interface Developer
- Current phase: Laboratory workbench refinement
- Overall state: VALIDATION_PENDING
- Last updated: 2026-09-12
- Starting main: `9b83dfe08a3657ac920b0181a8aaac875623030f`
- Active branch: `feature/lab-ui-workbench-refinement`
- Active PR: pending

## Objective
Refine the merged laboratory workbench UI so the central bench reads as a practical interaction surface rather than an illustrated scene, while preserving existing provider integration and scientific ownership boundaries.

## Refinement scope
- Remove decorative background laboratory tools and sticky-note copy from the central workspace.
- Retain only subtle grid/wall/counter treatment plus one functional primary-vessel target.
- Add desktop/tablet collapsible catalog rail; collapsed state gives workspace width back to the center and remains easy to reopen.
- Add collapsible experiment-condition console with compact temperature / pressure / volume summary while closed.
- Replace catalog decorative molecule thumbnails with compact thin-line structural notation (`H-H`, `O=O`, `N≡N`, `H-O-H`, etc.).
- Keep the right inspector's notebook treatment restrained: faint rules, compact typography, no scrapbook/sticky-note decoration.
- Keep the header thin and functional.

## Functional preservation
- catalog selection/search/filter/favorites
- finite mol AddSubstance provider command
- progression access and undiscovered identity secrecy
- inspector and free-form My Notes
- temperature/pressure controller request semantics and provider-owned actual state
- volume control through SI typed boundary
- mix/stir/pause/reset provider commands
- phase supplied-data renderer
- analysis/discovery unlock
- Developer Mode isolation
- provider-backed disposal with confirmation
- responsive mobile navigation

## Science / architecture boundaries
- UI -> provider/state/selectors only.
- no reaction feasibility, stoichiometry, products, phase truth, thermodynamics, kinetics, molar-mass calculation, or notebook truth evaluation in React.
- no direct SetTemperature command.
- no pressure-state overwrite.
- structural notation is a presentation mapping for the currently supported UI catalog and does not perform chemistry calculation.

## Validation
Pending consolidated checkpoint on exact branch HEAD:
- npm ci --no-audit --no-fund
- npm run typecheck
- npm run lint
- targeted UI tests
- full npm test
- npm run build
- browser smoke: desktop 1536×900 / 1440×900, tablet 1024×768, mobile 390×844
- catalog open/close + center expansion
- experiment console open/close + compact current-condition summary
- structural notation visible
- decorative sticky/tool elements absent
- no horizontal overflow
- no blocking console/page errors

## Gate
**VALIDATION_PENDING** — do not hand off until the consolidated checkpoint is green on the exact refinement HEAD.
