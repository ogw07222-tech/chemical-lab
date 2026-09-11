# 03 — Chemistry Data & Validation

- Owner: Chemistry Data Researcher / Chemical Property Data Engineer / Scientific Reference Analyst / Chemistry Model Validation Researcher
- Current phase: Phase 2C — Minimum Chemistry Data Pack
- Overall state: READY_FOR_REVIEW
- Last updated: 2026-09-11
- Source main at task start: `901f812edad16b67c0382e1a30ce744f2e6cd234`
- Latest main incorporated before finalization: `a4606143e8f249e5b9a398f72c86c8171ca405b5`
- Active branch: `feature/phase2-chemistry-data-pack`
- Active PR: pending creation
- Exact data/code/test HEAD validated by Actions: `07d8eaa4f29b99ea21789d45d098dcdceeb69a0d`
- Post-validation branch refresh commit: `457a9f818a701a4161775c22433c294671e63f5d`

## Current Objective
Provide the smallest sourced H/C/N/O chemistry data pack needed for 01 reaction-candidate work, 02 thermodynamic evaluation, and 06 validation without expanding into a bulk chemistry database or moving reaction logic into 03.

## Implemented Coverage

### Elements
- H, C, N, O only. Na/Cl remain intentionally out of scope because no current Phase 2 consumer requires them.
- CIAAW 2024 standard atomic-weight intervals.
- CIAAW 2024 abridged atomic-weight values projected to deterministic engine molar masses in kg/mol and explicitly marked `APPROXIMATED` rather than isotope-specific atomic masses.
- Pauling electronegativity, valence-electron count, selected/common oxidation states, restricted common neutral-covalent valences, and convention-tagged covalent radii.
- NIST ASD v5.12 first ionization energies normalized from eV to J/particle.
- Electron affinity for H/C/O where the chosen compiled source reports a stable value; N remains explicitly missing/OPEN.
- Isotope-specific `atomicMass` remains unpopulated because no isotope identity has been selected; no natural-element average is mislabeled as an isotope mass.

### Species / Thermochemistry
Minimum species: H2, O2, N2, H2O, CO, CO2, CH4, NH3.
- Standard formation enthalpy and standard molar entropy at reference conditions where selected NIST WebBook values are available.
- H2/O2/N2 standard formation enthalpy is explicitly zero by reference-state definition, not by missing-value fallback.
- H2O has separate gas and liquid records.
- CH4 records a conflict-resolution note selecting the NIST-listed Manion (2002) adopted recommendation rather than averaging multiple listed values.
- A single CH4 gas Cp value at 298.15 K is included and marked `EMPIRICAL`; it is not licensed for arbitrary-temperature extrapolation.
- Standard Gibbs formation energies, broad Cp(T) correlations, and detailed equilibrium constants remain OPEN in this minimum pack.

### Bond Reference Values
Selected H-H, O=O, N#N, C-H(CH4), N-H(NH3), O-H(H2O), and C=O(CO2) compiled bond enthalpies are present in J/mol.
They are deliberately marked `EMPIRICAL` / MEDIUM-confidence fallback values and are not represented as molecule-specific spectroscopic D0 values.

### Reference Phase
At 298.15 K and 100000 Pa the pack carries simple reference-phase records for all eight species: H2/O2/N2/CO/CO2/CH4/NH3 gas and H2O liquid.
These are reference-condition checks only; melting/boiling points and full T-P phase boundaries are not fabricated in this pass.

## Provenance Sources
- CIAAW Standard Atomic Weights 2024.
- CIAAW Abridged Standard Atomic Weights 2024.
- NIST Atomic Spectra Database SRD 78, version 5.12.
- NIST Chemistry WebBook SRD 69.
- Royal Society of Chemistry periodic-table property compilations for H/C/N/O.
- An explicit internal derivation source only for the standard thermochemical reference-state zero convention.

All populated records preserve source value/unit independently from normalized SI value/unit. Uncertainty is retained where reported; `not_reported` is used instead of invented zero uncertainty.

## Engine-Facing API
`src/data/provider.ts` provides:
- `minimumElementProvider: ElementProvider` — exact 01-compatible projection to `ElementDefinition`.
- `minimumChemistryDataProvider.getElementData(symbol)` — provenance-rich element record.
- `minimumChemistryDataProvider.getElementDefinition(symbol)` — deterministic 01 runtime projection.
- `minimumChemistryDataProvider.getSpeciesThermodynamics(speciesId, phase?)` — 02 phase-specific thermochemical lookup.
- `minimumChemistryDataProvider.getPhaseEquilibrium(speciesId)` — current reference-phase/phase-data lookup.
- `minimumChemistryDataProvider.getBondEnergyById(id)` and `findBondEnergies(...)` — selected bond/reference lookup.

Missing values return `undefined`; no missing value is mapped to zero, NaN, Infinity, or a guessed constant.

`src/data/index.ts` exports the stable 03 data surface.

## 06 Reference Cases
`src/data/minimum-reference-cases.ts` supplies procedure-free reference fixtures for:
- atom/conservation identity;
- balanced stoichiometric expectations;
- thermochemical sign/reference enthalpy for H2 oxidation, CO oxidation, and CH4 complete oxidation using stored formation data;
- simple 298.15 K / 1 bar reference-phase checks.

These fixtures are validation oracles only. They contain no reaction-generation rule and no experimental handling procedure.

## Runtime Validation
`validateChemistryDataBundle` and `validateMinimumChemistryDataPack` check:
- duplicate source/element/thermo/phase/bond identifiers;
- registered provenance source IDs;
- populated-value provenance requirement;
- explicit source unit;
- canonical normalized SI unit;
- finite numeric values only;
- no NaN/Infinity;
- interval ordering;
- positive reference temperature;
- non-negative reference pressure.

## Tests / Validation Evidence
One temporary branch-only workflow was used and then removed from the final diff.

Validated exact code/data/test HEAD: `07d8eaa4f29b99ea21789d45d098dcdceeb69a0d`.
GitHub Actions run: `34591104021`.
- `npm ci --no-audit --no-fund`: PASS.
- `npm run typecheck`: PASS.
- targeted `tests/chemistry-data-pack.test.ts`: 16/16 PASS.
- full `npm test`: 6 files / 89/89 PASS.
- `npm run lint`: PASS.

The only commits after that validated code HEAD remove the one-shot workflow, incorporate the newer main status-only 07 commit, and update this 03 status document; chemistry/data/test source bytes are unchanged.

## PASS / FAIL / OPEN

### PASS
- H/C/N/O minimum element pack.
- All eight requested species represented in thermo/reference-phase lookup.
- SI normalization and source-unit separation.
- Deterministic 01 `ElementProvider` projection.
- 02 typed thermo/phase/bond lookup surface.
- 06 safe reference-case surface.
- Provenance/finiteness/duplicate/missing-behavior validators.
- Typecheck, targeted tests, full tests, and lint.

### FAIL
- None blocking in the validated Phase 2C scope.

### OPEN
- isotope-specific atomic masses;
- N electron affinity in the selected source set;
- ΔGf° population and broader equilibrium data;
- most Cp values and Cp(T) correlations;
- melting/boiling/triple/critical/full phase-boundary data;
- detailed kinetic/rate/activation datasets;
- broader molecule-specific BDE/D0 coverage;
- Na/Cl extension until an actual 01/02/06 consumer requires it;
- larger real-experiment benchmark corpus.

## Handoffs
- **01 Chemistry Simulation Engine:** import `minimumElementProvider` for the current `ElementProvider` contract. Use `minimumChemistryDataProvider.getElementDefinition(symbol)` when direct per-symbol lookup is preferable. Treat absent symbols/properties as unsupported rather than defaulting them.
- **02 Thermodynamics & Kinetics:** use `getSpeciesThermodynamics(speciesId, phase?)`, `getPhaseEquilibrium(speciesId)`, and bond lookup methods. Respect record `status`, `confidence`, reference conditions, uncertainty, and missing `undefined`; 03 does not decide reaction direction/rate/phase evolution.
- **06 Simulation Validation Lab:** consume `minimumChemistryReferenceCases` plus `validateMinimumChemistryDataPack()` as the seed reference/eligibility layer. Reference cases are oracles only and must never be imported into production reaction logic.
- **07 Integration & GitHub:** Phase 2C input now exists on `feature/phase2-chemistry-data-pack`; audit and integrate this exact submitted branch/PR using the validated code HEAD evidence above.
