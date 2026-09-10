# Chemistry Data Contract — Phase 0

Status: PROPOSED
Owner: 03 - Chemistry Data & Validation
Scope: normalized scientific property data, provenance, phase/thermal data, and reference experiment fixtures consumed by 01/02/06.

## 1. Contract goals

The runtime consumes normalized, versioned scientific records. It must not scrape web pages at runtime, embed unexplained constants, silently average conflicting sources, infer missing values as zero, or mix source units with authoritative simulation units.

The MVP remains deliberately small: H, C, N, O and H2, O2, N2, H2O, CO, CO2, CH4, NH3. Numerical ingestion is demand-driven by 01/02 and benchmark acquisition is demand-driven by 06 and `REAL_EXPERIMENT_VALIDATION.md`.

## 2. Scientific status and confidence

Every scientific record uses one of:

- `VERIFIED`: traceable high-quality evidence, compatible conditions, no unresolved material conflict for the intended use.
- `APPROXIMATED`: scientifically motivated estimate/interpolation/simplified representation.
- `EMPIRICAL`: fitted experimental correlation/model with a recorded validity domain.
- `GAMEPLAY_SIMPLIFICATION`: deliberate simplification approved across the owning workstreams; never presented as reference chemistry.
- `OPEN`: missing, unresolved, incompatible, or insufficiently specified.

`confidence` is independent: `HIGH | MEDIUM | LOW | UNASSESSED`.

## 3. SI normalization contract

`docs/contracts/UNIT_SYSTEM.md` is authoritative. Machine-consumed normalized chemistry data MUST use canonical SI units.

Source values MAY use chemistry-conventional units, but source and normalized representations are distinct:

- `sourceValue`
- `sourceUnit`
- `normalizedValue`
- `normalizedUnit`

The separation is REQUIRED for imported numeric data because provenance must preserve exactly what the source reported while the runtime receives one unit system.

Examples:

- pm / Angstrom -> m
- eV per particle -> J per particle
- kJ/mol -> J/mol
- bar / atm / torr -> Pa
- L -> m^3
- mol/L -> mol/m^3

Do not overwrite the source representation after conversion. Conversion must be deterministic, centralized, versionable, and testable.

### Canonical normalized units

- amount: mol
- per-particle mass: kg
- molar mass: kg/mol
- length/radius: m
- time: s
- temperature: K
- pressure: Pa
- volume: m^3
- concentration: mol/m^3
- energy: J
- molar energy/BDE/formation enthalpy/Gibbs/latent heat/proton affinity: J/mol
- molar entropy/Cp: J/(mol*K)
- system heat capacity: J/K
- electric potential: V
- dimensionless quantities: `1`

Standard atomic weight is dimensionless and MUST NOT be conflated with atomic mass or molar mass.

## 4. Common property/provenance record

A populated property must retain, as applicable:

- normalized value/unit
- one or more source measurements with original value/unit
- source identifier
- reference temperature/pressure
- phase
- solvent/activity convention
- uncertainty
- data quality
- confidence
- scientific status
- last verified date
- validity range / applicability notes
- conflict resolution note when alternatives exist

Null/missing values are explicit. `0`, NaN, empty strings, or guessed defaults are forbidden missing-data encodings.

`SourceRecord` should retain title, authors/publisher, source type, citation, URL/DOI, database/version, accessed date, table/query context, and license/usage notes.

A URL by itself is not sufficient provenance.

## 5. Element and bond data

For H/C/N/O, the schema supports:

- atomic number
- atomic mass when actually required
- standard atomic weight
- molar mass when required by mass/amount conversion
- electronegativity with named scale
- valence electrons
- common oxidation states
- covalent radius with convention
- ionic radius with charge/coordination/spin convention where applicable
- ionization energy
- electron affinity

Bond-energy records must distinguish molecule-specific BDE from average bond enthalpy and record species/bond context, dissociation products, phase/conditions, status, and uncertainty. Average textbook bond enthalpies are not `VERIFIED` molecule-specific BDEs.

## 6. Thermal property schema and priority

For each species/phase required by 02, collect in this priority order when available:

1. standard enthalpy of formation, J/mol
2. standard Gibbs energy of formation, J/mol, and/or standard molar entropy, J/(mol*K)
3. molar heat capacity at a stated temperature, J/(mol*K)
4. temperature-dependent Cp correlation with equation, coefficients, coefficient units, source, uncertainty, and valid T range
5. enthalpy of fusion, J/mol
6. enthalpy of vaporization, J/mol

02 should prefer direct/evaluated formation thermochemistry for reaction energy reconstruction before generic bond-energy fallback, consistent with its current Phase 0 design.

A Cp scalar is valid only at its recorded condition. It MUST NOT be extrapolated across an arbitrary temperature range without an explicit approximation/model record.

Latent heats are separate from sensible heat capacity and must remain separate inputs for thermal/vessel state accounting.

## 7. Phase-equilibrium property schema

`PhaseEquilibriumData` supports, when available:

- phase label at explicit reference conditions
- melting point
- boiling point with its pressure
- triple-point temperature and pressure
- critical-point temperature and pressure
- vapor-pressure data/model
- phase-transition enthalpies
- one or more phase-boundary representations
- valid temperature range
- valid pressure range
- uncertainty/status/confidence/provenance

Melting/boiling scalar values are reference points, not complete T-P phase boundaries.

Normal boiling point MUST identify the reference pressure.

## 8. Phase-boundary representations

Complete experimental T-P curves will not exist for every species. The schema therefore supports four explicit forms:

### A. `EXPERIMENTAL_SAMPLES`
A set of source-backed `(T, P)` samples with uncertainty.

### B. `FITTED_CORRELATION`
An empirical/fitted equation with:

- model/equation identifier
- coefficients
- coefficient units
- source IDs used for the fit
- valid T/P range
- uncertainty/fit-quality notes

### C. `TRUSTED_MODEL_REFERENCE`
A published/evaluated model reference plus required parameters and validity range.

### D. `APPROXIMATION`
A documented scientific approximation with assumptions and validity bounds. It must be labeled `APPROXIMATED` or `GAMEPLAY_SIMPLIFICATION`, never silently presented as a measured curve.

No phase diagram should display precision unsupported by the underlying representation.

Near a boundary, phase determination should expose uncertainty/applicability rather than forcing false certainty when source/model uncertainty overlaps the operating point.

## 9. Query contract for 02

03 provides data records; 02 owns the physical evaluator. The proposed query boundary is conceptually:

```ts
ChemistryDataQuery {
  speciesId?: string
  elementSymbol?: string
  property: THERMOCHEMISTRY | HEAT_CAPACITY | PHASE_POINT |
            PHASE_BOUNDARY | VAPOR_PRESSURE | LATENT_HEAT |
            BOND_ENERGY | ATOMIC_PROPERTY
  temperatureK?: number
  pressurePa?: number
  phase?: Phase
  requiredStatus?: ScientificStatus[]
}
```

The result returns:

- record when available
- scientific status/confidence
- applicability: `EXACT | WITHIN_VALID_RANGE | EXTRAPOLATED | INCOMPATIBLE | MISSING`
- notes

03 does not decide reaction direction, phase, equilibrium, thermal evolution, or kinetics. 02 decides those from the returned data/model records.

## 10. Reference experiment benchmark contract

`src/data/benchmark-schema.ts` defines machine-loadable reference experiment fixtures for 06.

A benchmark should support, where scientifically relevant:

- benchmark ID and schema version
- benchmark family and Tier A/B/C/D
- source IDs
- reactant/species identities
- amounts in mol
- concentrations in mol/m^3
- initial temperature K
- initial pressure Pa
- vessel volume m^3
- phases
- solvent
- catalyst
- apparatus/boundary assumptions
- measurement duration s / endpoint definition
- measured products
- conversion/yield fractions
- equilibrium composition
- final/delta temperature
- final/delta pressure
- heat effect / reaction enthalpy
- kinetic timescale
- uncertainty
- data quality
- confidence
- scientific status
- applicability/exclusion notes
- last verified date

Authoritative fixture values loaded by 06 are normalized SI values. Original reported units remain preserved through source/provenance records where useful.

A benchmark is not automatically eligible for scoring merely because a file exists. Insufficiently specified initial conditions, apparatus, endpoint, source quality, or uncertainty should make it `OPEN`/excluded rather than a fabricated quantitative target.

## 11. Benchmark source quality policy

Preferred evidence order follows `REAL_EXPERIMENT_VALIDATION.md`:

1. authoritative database / standard
2. peer-reviewed experimental literature
3. trusted handbook / research or educational institution
4. lower-confidence secondary material only when explicitly labeled and normally not used for HIGH-confidence release gates

An inferred or tuned value is never promoted to an experimental benchmark because primary data are unavailable.

Internal simulation output must never be used as external benchmark truth.

## 12. Benchmark directory proposal for 06

```text
src/data/
  schema.ts
  benchmark-schema.ts
  ...normalized property datasets...

benchmarks/
  chemistry/
    manifest.json
    phase/
    gas-state/
    calorimetry/
    equilibrium/
    reaction-direction/
    non-reaction/
    kinetics/

tests/validation/
  benchmark-loader.test.ts
  benchmark-schema.test.ts
```

`manifest.json` contains benchmark IDs, relative fixture paths, family, tier, enablement, and tags. 06 loads only approved manifest entries and reports OPEN/excluded cases separately.

## 13. Initial MVP benchmark acquisition plan

Do not bulk-collect data yet. First acquire a small independent reference set in this order:

1. **Simple phase points** — H2O, CO2, O2, N2, CH4, NH3 where trustworthy data exist; include points clearly away from boundaries.
2. **Melting/boiling/triple/critical references** — prioritize H2O, CO2 and simple gases with strong evaluated reference data.
3. **Simple gas-state checks** — closed single-component or simple inert-mixture P-V-T cases in the supported equation-of-state regime.
4. **Combustion heat/direction** — CH4/O2 and CO/O2 net reaction direction and reaction enthalpy/calorimetry references under clearly specified conditions.
5. **Simple equilibrium** — only where reactants/products and equilibrium composition/K data are sufficiently specified for a fair runtime comparison; do not force this if MVP chemistry does not yet model the family.
6. **Known non-reaction / inert-condition cases** — matched conditions where a plausible candidate should remain negligible or absent on the benchmark timescale.
7. **Kinetic perturbation pairs** — only after 02 claims kinetic condition response; prioritize relative ordering over unsupported absolute rates.

The first benchmark pack should maximize independence and coverage rather than repeat one reaction many times.

## 14. Missing-data behavior

Resolution order:

1. exact compatible `VERIFIED` record
2. compatible evaluated record plus deterministic unit normalization
3. `APPROXIMATED` estimate with method and validity domain
4. `EMPIRICAL` correlation within its documented domain
5. approved `GAMEPLAY_SIMPLIFICATION`
6. `OPEN` / caller-visible missing result

For phase/thermal data specifically:

- no vapor-pressure curve -> do not fabricate one from boiling point alone;
- no Cp(T) -> use a scalar only within an explicitly approved narrow regime or return OPEN;
- no latent heat -> phase-transition energy coupling remains OPEN/approximated rather than zero;
- no phase boundary -> phase evaluator may use a declared fallback, but the data layer records the absence and lower status.

Missing benchmark measurements are omitted, not set to zero. A benchmark can still be useful for qualitative Tier A validation if its quantitative fields are unavailable.

## 15. Conflict resolution

Conflicting values remain separate candidates until the cause is resolved.

Check, in order:

1. species/isotope/charge/polymorph identity
2. phase
3. temperature/pressure/solvent/composition
4. standard-state and measurement convention
5. quantity definition
6. source unit and normalization conversion
7. source authority/evaluation/revision
8. reported uncertainty and experimental method

Select a preferred record only with a written resolution note while retaining alternatives. Arithmetic averaging is not the default conflict policy.

For fitted phase/thermal correlations, overlapping valid ranges must be compared within their stated domains; a correlation is not globally preferred merely because it is newer or numerically smoother.

## 16. Validation rules

Data validators should reject or flag:

- normalized numeric property using a non-SI runtime unit
- populated normalized value without an original source measurement or explicit internal-derivation source
- source measurement without source unit
- non-finite numbers
- T <= 0 K
- P < 0 Pa
- invalid ranges (`min > max`)
- uncertainty incompatible with its representation
- `VERIFIED` data without externally traceable high-quality evidence
- electronegativity without scale
- ionic radius without charge/context
- molecule-specific BDE without species/bond context
- phase-boundary correlation without equation/model and valid range
- normal boiling point without pressure context
- triple/critical point missing either T or P
- Cp correlation without valid T range
- pKa without solvent/condition convention
- electrode potential without couple/reference-electrode context
- conflicting preferred records for the same property-condition key
- benchmark with no source
- benchmark Tier B/C/D quantitative claim without enough initial-condition/endpoint metadata for a fair comparison
- benchmark SI fixture values encoded in display/source units

Cross-source numerical agreement alone is not enough for `VERIFIED`.

## 17. Current verdict

- Existing provenance/status architecture: PASS.
- Existing pre-refresh runtime unit policy (`Da`, `pm`, `eV`, `kJ/mol` as canonical): FAIL against approved `UNIT_SYSTEM.md`; corrected in the refreshed schema proposal.
- SI source/normalized separation: PASS as a Phase 0 contract.
- Phase-equilibrium and boundary representation: PASS as a Phase 0 schema proposal.
- Thermal-property coverage: PASS as a Phase 0 schema proposal.
- Real-experiment benchmark schema: PASS as a Phase 0 proposal aligned with `REAL_EXPERIMENT_VALIDATION.md`.
- Numerical property population: OPEN.
- Benchmark acquisition/results: OPEN until 03 collects approved cases and 06 implements the loader/runner.
