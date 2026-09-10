# Chemistry Data Source Registry

Owner: 03 - Chemistry Data & Validation
Status: Phase 0 source candidates; numerical ingestion is intentionally deferred.
Last reviewed: 2026-09-10

This registry identifies preferred source families and the quantity domains for which they are appropriate. It is not itself a numerical dataset or an experiment benchmark set.

## Source priority

For normalized property data:

1. Critically evaluated scientific/reference database or standards body
2. Government/research-institute database
3. Peer-reviewed primary/evaluated literature
4. Trusted handbook/research or educational institution
5. Reputable secondary source

For real-experiment benchmarks used by 06:

1. authoritative database / standard
2. peer-reviewed experimental literature
3. trusted handbook / research or educational institution
4. lower-confidence secondary material only when explicitly labeled and normally excluded from HIGH-confidence release gates

A secondary source does not become primary evidence merely because multiple websites repeat the same number. Internal simulation output, fitted game constants, or analyst guesses are never external benchmark truth.

## Preferred MVP sources

### CIAAW — Standard Atomic Weights

- Organization: Commission on Isotopic Abundances and Atomic Weights (CIAAW), IUPAC commission
- Source type: STANDARD_OR_GOVERNMENT
- Intended use: standard atomic weights and isotope-composition context for H, C, N, O
- Current table observed during Phase 0 research: Standard Atomic Weights 2024
- URL: https://ciaaw.org/atomic-weights.htm
- Notes: Several elements, including H/C/N/O, are represented by intervals in the full standard-atomic-weight table because natural isotopic composition varies. Preserve the interval rather than replacing it silently with a midpoint. Standard atomic weight is dimensionless; do not store it as atomic mass.

### NIST Atomic Spectra Database — SRD 78

- Organization: National Institute of Standards and Technology
- Source type: REFERENCE_DATABASE
- Database: NIST Atomic Spectra Database (ASD), SRD 78
- Version observed during Phase 0 research: 5.12, data content updated November 2024
- DOI: 10.18434/T4W30F
- URL: https://physics.nist.gov/asd
- Intended use: critically evaluated atomic/ionic energy-level and ionization-energy data
- Notes: Preserve explicit uncertainty and bibliography. Source eV values may be retained in provenance, but normalized per-particle energy supplied to the runtime is J.

### NIST Chemistry WebBook — SRD 69

- Organization: National Institute of Standards and Technology
- Source type: REFERENCE_DATABASE
- Database: NIST Chemistry WebBook, SRD 69
- Data update observed during Phase 0 research: 2025
- DOI: 10.18434/T4D303
- URL: https://webbook.nist.gov/
- Intended use: thermochemistry, reaction thermochemistry, heat capacities, vapor-pressure/phase-transition/thermophysical data, and ion energetics where available for MVP species
- Notes: Preserve phase, method/review status, temperature ranges, source-specific comments, and individual literature references. Non-SI source values such as kJ/mol are retained as source measurements while normalized runtime values are converted to SI. Multiple values on a species page are candidates, not values to average automatically.

## Phase / thermal / benchmark source acquisition

Before choosing a phase-boundary or calorimetric source, determine whether the source provides direct experimental points, a fitted correlation, or an evaluated model. Preserve that distinction in the normalized record.

For phase data, prefer critically evaluated vapor-pressure/correlation data and explicitly reported triple/critical points when available. A normal boiling point is only one boundary point and must not be expanded into an invented full curve.

For calorimetry or reaction benchmarks, require enough initial-condition and apparatus/endpoint information to compare simulation and experiment fairly. A trustworthy reaction enthalpy datum may validate thermochemistry without being sufficient as a full vessel-temperature benchmark.

## Source gaps requiring targeted evaluation later

The following remain `OPEN` until active consumers require them:

- electronegativity scale: choose a named scale; do not mix Pauling/Mulliken/Allen values
- covalent radii: select a documented definition and preserve its convention
- ionic radii: require ion charge and coordination/state convention
- common oxidation states: define whether 01 needs textbook-common states, experimentally known states, or heuristic priors
- molecule-specific bond dissociation energies: distinguish evaluated molecule-specific values from averaged textbook bond enthalpies
- pKa/proton affinity source family
- standard electrode potentials source family
- solubility/Ksp source family
- reaction-specific kinetic constants and activation energies
- experiment benchmark families whose apparatus or endpoint cannot yet be represented by 02/04

## Ingestion rule

Before a numerical source is added to `src/data` or `benchmarks/chemistry`, create or reference a `SourceRecord` with sufficient citation/version/access context to reproduce the lookup.

Every imported numeric quantity preserves `sourceValue` + `sourceUnit` and provides an SI `normalizedValue` + `normalizedUnit` before entering authoritative runtime calculations or validation fixtures.

If candidate sources disagree materially, retain them separately during investigation and document the cause/resolution. Never resolve a conflict by averaging before checking species identity, phase, reference conditions, quantity definition, unit conversion, revision status, uncertainty, and experimental method.
