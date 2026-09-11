# Reaction Candidate Engine v1 — Phase 2A

Status: EXECUTABLE FOUNDATION
Owner: 01 — Chemistry Simulation Engine

This contract is the executable Phase 2A companion to `MOLECULAR_REACTION_CORE.md` and `SIMULATION_CONTRACT.md`. It does not replace thermodynamics, kinetics, equilibrium, phase equilibrium, or state-progression ownership.

## API

```ts
generateReactionCandidates({ species, elements, environment?, options? }): readonly ReactionCandidate[]

generateReactionCandidatesWithDiagnostics({ species, elements, environment?, options? }): ReactionCandidateGenerationResult
```

Input `SpeciesState`, molecular graphs, element definitions, canonical molecule identity, graph validation, and conservation primitives are imported from the existing Phase 1 molecular core. Phase 2A does not redefine them.

## ReactionFamily v1 vocabulary

- `ASSOCIATION`
- `DISSOCIATION`
- `BOND_FORMATION`
- `BOND_CLEAVAGE`
- `PROTON_TRANSFER`
- `ELECTRON_TRANSFER`
- `SUBSTITUTION_GENERIC`
- `COMBINATION`
- `DECOMPOSITION`

The executable v1 generators currently emit `BOND_FORMATION`, `BOND_CLEAVAGE`, `PROTON_TRANSFER`, and `ELECTRON_TRANSFER`. The remaining values are reserved family vocabulary for later generic rules; they are not reaction lookup entries.

## ReactionCandidate guarantees

Every emitted candidate contains:

- deterministic candidate `id` for the same authoritative input/options;
- primary reaction `family`;
- finite positive reactant/product stoichiometric coefficients;
- proposed `productGraphs` represented as validated `MoleculeRecord`s;
- reactant-to-product atom mapping when the transformation preserves explicit atoms;
- bond additions/removals/order-change metadata;
- atom formal-charge changes;
- proton/electron transfer metadata where generated;
- `structuralConfidence`, assumptions, and generic `ruleId`;
- a conservation result that has already passed the 01 hard gate;
- debug structural key/rule priority/site keys.

`structuralConfidence` ranks structural plausibility only. It is not reaction probability, thermodynamic favorability, equilibrium position, or kinetic rate.

## Reactive-site v1 rules

The detector uses generic graph/data signals:

- explicit positive/negative formal charge;
- hetero atoms;
- coarse under-coordination from `typicalValences`;
- coarse electron-rich/electron-poor classification;
- hetero-bound explicit H as proton-donor evidence;
- non-positive hetero sites as coarse proton-acceptor evidence;
- electronegativity difference when the element provider supplies it;
- existing bonds as breakable-bond candidates.

Over-coordinated states under the coarse valence policy are rejected before candidate generation/evaluation. Missing valence/electronegativity data does not create false precision; the engine omits rules that require unavailable data or produces lower-confidence structural candidates from the remaining evidence.

## Transformation primitives

Phase 2A provides immutable/copy-based primitives:

- `addBond`
- `removeBond`
- `changeBondOrder`
- `mergeGraphs`
- `splitGraph`
- `transferProton`
- `transferElectronMetadata`
- formal-charge update helper used by transfer primitives

These functions do not mutate authoritative vessel state.

## Conservation gate

A candidate is never emitted to 02 unless it conserves:

- element counts;
- total explicit atom count;
- net charge for the closed-system v1 generators;
- explicit electron bookkeeping when that field is used.

Phase 2A does not implement an external electron reservoir. Electrochemical/open-system electron exchange remains OPEN for later contract work.

## Candidate explosion controls

The engine uses:

- bounded reactive sites per species;
- pair accessibility filtering;
- only local generic transformations;
- product graph/valence rejection before emission;
- structural no-op elimination;
- deterministic structural deduplication;
- deterministic per-family candidate caps;
- deterministic total candidate cap;
- bounded sampled pruning reasons for debugging.

Solid-containing inter-species pairs require an explicit `environment.contactPairs` hint in v1. This is only a structural-accessibility gate; no diffusion, surface kinetics, or phase thermodynamics are calculated by 01.

## 02 handoff

02 may rely on these fields of an emitted candidate:

- `id`
- `family`
- `reactantRefs`
- `productGraphs` and their canonical keys/formulas/net charges
- `atomMapping`
- `bondChanges`
- `chargeChanges`
- `electronTransfer` / `protonTransfer` when present
- `stoichiometry`
- `structuralConfidence`
- `assumptions`
- `ruleId`
- `conservation.valid === true`

02 must not infer ΔH, ΔS, ΔG, activation energy, rate, equilibrium, phase stability, or reaction extent from `structuralConfidence` or `ruleId`. Those remain separate 02 evaluations.

## Known limitations / OPEN

- coarse valence is not a full quantum/cheminformatics valence model;
- resonance, aromaticity, coordination complexes, stereochemistry, implicit hydrogens, solvent structure, radicals, and hypervalent chemistry need later specialized rules;
- bond cleavage candidates can represent radical-like fragments without claiming their stability;
- proton-transfer formal-charge updates are generic structural bookkeeping and require 02/03 physical evaluation;
- electron-transfer v1 only considers explicit opposite formal-charge sites and does not use redox potentials;
- `SUBSTITUTION_GENERIC` and higher semantic families are contract-only in Phase 2A;
- no reaction extent or authoritative state mutation occurs in this module.
