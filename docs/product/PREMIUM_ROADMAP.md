# Premium Roadmap

## Purpose

This document defines the long-term separation between the standard game experience and optional premium features.

The project must remain a complete chemistry sandbox without requiring premium access for core chemistry, discovery, or scientific progression.

## Core Product Rule

The standard game must include the full core gameplay loop:

`experiment -> create species -> analyze/confirm -> encyclopedia discovery -> inventory unlock -> reuse in later experiments`

A player must never need premium access to make a chemically valid reaction possible, discover a supported compound, or progress through the core encyclopedia system.

Premium features should primarily provide convenience, organization, visualization, customization, and advanced laboratory workflow tools.

## Standard vs Premium

| Area | Standard | Premium |
| --- | --- | --- |
| Chemistry simulation | Full supported chemistry engine | Same chemistry engine; no hidden boosts |
| Reaction outcomes | Identical scientific rules | Identical scientific rules |
| Compound discovery | Full discovery system | Same discovery system |
| Encyclopedia unlocks | All supported compounds can be discovered | Same compounds; richer organization/visualization may be available |
| Inventory unlock rule | Confirmed discovered compounds become reusable | Same rule |
| Starting access | Only designated starter materials and previously unlocked compounds | Same gameplay rule |
| Developer all-unlock | Not available in normal play | Not a premium perk; developer/debug mode only |
| Experiment slots | Core usable amount | Additional saved experiment/workspace slots may be premium |
| Experiment history | Basic history/log | Extended history, tagging, filtering, search, folders |
| Experiment comparison | Basic before/after comparison | Multi-run overlays, richer comparative analytics |
| Graphs | Essential graphs | Advanced graph controls, overlays, export-oriented views |
| Molecule viewer | Core molecular structure view | Advanced visualization layers where useful |
| Reaction visualization | Core observable reaction feedback | Advanced pathway/bond-change visualization if scientifically supported |
| Laboratory workspace | Core laboratory workspace | Additional workspace layouts or simultaneous saved setups |
| Instruments | Instruments required for core progression remain available | Convenience/advanced analysis presentation only; must not paywall required scientific progression |
| Encyclopedia | Core searchable encyclopedia | Tags, collections, discovery maps, relationship graphs, enhanced personal statistics |
| Themes / cosmetics | Default visual set | Optional laboratory/UI themes, vessel/equipment skins |
| Cloud / sharing | Core local experience must remain usable | Enhanced synchronization, sharing, or archival features may be considered later |
| Chemistry accuracy | Full supported scientific model | No accuracy advantage over standard |
| Simulation speed | Normal playable simulation | Premium must not grant a chemistry/progression advantage by changing simulated reaction physics |

## Explicitly Forbidden Premium Advantages

The following must not become premium benefits:

- unlocking undiscovered compounds for normal gameplay;
- exclusive elements or compounds required for the supported chemistry sandbox;
- favorable reaction probabilities or altered reaction products;
- lower activation barriers, faster physical reaction rates, or modified equilibria;
- conservation-rule exceptions;
- higher scientific accuracy than standard users receive;
- exclusive reaction families;
- paying to bypass the core discovery progression;
- progression bonuses that modify chemistry behavior.

Premium must never create a separate chemistry engine.

## Recommended Premium Feature Families

### 1. Advanced Experiment Archive

Potential premium features:

- larger experiment-history capacity;
- folders and tags;
- advanced search/filtering;
- saved templates;
- experiment branching/version history;
- richer replay navigation.

This is the strongest premium category because it improves serious experimentation without changing scientific outcomes.

### 2. Advanced Comparison Lab

Potential premium features:

- compare more than two experiments at once;
- overlay temperature, pressure, amount, concentration, and reaction-rate series;
- synchronized timeline comparison;
- automatically highlight changed control variables;
- advanced filtering by species or observation type.

Standard users should still receive enough comparison functionality to understand their experiments.

### 3. Enhanced Encyclopedia

Potential premium features:

- personal discovery timeline;
- compound collections/tags;
- relationship graph between discovered species;
- reaction-family relationship map;
- first-discovery experiment links;
- richer statistics about player discoveries.

The chemical information required to understand and use a discovered species must not be withheld from standard users.

### 4. Laboratory Customization

Good low-risk premium content:

- laboratory visual themes;
- vessel skins;
- equipment skins;
- UI themes;
- cosmetic workspace customization.

These are suitable because they do not affect chemistry or progression integrity.

### 5. Advanced Visualization

Possible premium convenience/visualization features:

- richer molecule rendering options;
- reaction bond-change overlays;
- advanced timeline visualization;
- customizable dashboards;
- additional graph layouts.

Any scientific claim shown by premium visualization must come from the same validated simulation/data layer used by the standard game.

### 6. Expanded Workflow Capacity

Potential premium features:

- more saved laboratory setups;
- more named experiment presets;
- additional comparison boards;
- workspace organization tools;
- convenient batch duplication of experimental setups.

This must remain workflow convenience, not access to otherwise impossible chemistry.

## Developer Mode

Developer Mode is separate from both Standard and Premium.

It exists only for development, validation, QA, and debugging.

Developer Mode may include:

- unlock all species;
- bypass discovery requirements;
- spawn arbitrary supported amounts;
- inspect hidden simulation state;
- view reaction candidates/pruning/debug information;
- force or inject test states;
- access validation fixtures.

Developer Mode must not be marketed as a premium gameplay feature.

## Monetization Direction

Preferred initial model:

- standard game: complete core chemistry/discovery experience;
- optional one-time `Premium Lab Upgrade` or equivalent;
- premium focused on advanced workflow, analytics, archive capacity, visualization, and cosmetics;
- optional cosmetic expansions may be considered later.

Avoid designing the project around recurring spending, progression acceleration, or paid chemistry access.

The exact commercial model remains `OPEN` until the product has a playable core and real usage data.

## Roadmap Integration

### Phase 0-4

Do not implement monetization gates.

Only ensure architecture can distinguish:

- core feature capability;
- optional presentation/workflow capability;
- developer/debug capability.

Chemistry engine code must contain no premium branching.

### Phase 5 — Laboratory Game

Implement the complete standard gameplay loop first:

- experimentation;
- discovery confirmation;
- encyclopedia registration;
- inventory unlock;
- experiment logs;
- essential comparison and analysis.

Premium-specific UI should not block this milestone.

### Post-Phase 5 — Premium Foundation

Only after the core laboratory loop is stable, consider:

- advanced archive;
- additional saved workspace capacity;
- advanced comparison tools;
- enhanced encyclopedia organization;
- premium visual customization.

### Phase 6+

Premium can expand alongside advanced chemistry, but new chemistry capabilities themselves remain part of the standard scientific sandbox unless a later HQ decision explicitly changes the product model.

## Architecture Rule

Use capability/entitlement checks only in Game/UI/service layers.

Never place premium checks inside:

- molecular graph logic;
- reaction candidate generation;
- conservation validation;
- thermodynamics;
- kinetics;
- equilibrium;
- scientific property data.

Preferred dependency direction:

`Entitlement/Account Layer -> Game/UI feature availability`

while:

`Simulation Core -> identical behavior for all users`

## Status

- Product direction: APPROVED BY 00 HQ
- Commercial packaging details: OPEN
- Pricing: OPEN
- Subscription vs one-time purchase: OPEN, with one-time Premium Lab Upgrade currently preferred
- Premium implementation timing: after core Phase 5 gameplay is stable
