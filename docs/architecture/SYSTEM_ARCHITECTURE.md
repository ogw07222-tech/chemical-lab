# System Architecture

## Top-Level Modules

### Simulation Core
Pure chemistry/state transition logic. No UI or progression dependencies.

Suggested internal boundaries:
- atomic / element properties
- molecular graph
- species and phases
- reaction candidate generation
- conservation / stoichiometry
- thermodynamics interface
- kinetics interface
- reaction competition
- vessel state update

### Chemistry Data
Versioned property/reference data and provenance metadata. Simulation code consumes normalized interfaces rather than scraping or embedding ad-hoc values.

### Game Layer
Laboratory actions, progression, discovery, objectives, instruments, experiment history, and save/replay orchestration.

### Web UI
Presentation and interaction only. UI does not decide chemical outcomes.

### Validation
Scientific fixtures, property tests, randomized tests, regression baselines, determinism checks, performance/candidate-explosion tests.

## Dependency Direction
UI -> Game Layer -> Simulation Core -> Chemistry Data interfaces.
Validation may inspect all lower layers but does not become production chemistry logic.

## Performance Policy
Prefer active-species filtering, reaction-family filtering, locality, cached molecular properties, cached patterns, bounded candidate sets, adaptive timestep, and deterministic pruning. Avoid exhaustive reaction-network search in the real-time loop.

## Future Python Boundary
The browser runtime remains TypeScript-first. Python may be used for offline data preparation, scientific validation, Monte Carlo studies, and calibration tooling. Production browser chemistry should not require a Python server unless explicitly approved by workstream 00.
