import type { Phase, ScientificStatus } from "./schema";
import { REFERENCE_PRESSURE_PA, REFERENCE_TEMPERATURE_K } from "./minimum-pack";

export type ReferenceCaseKind =
  | "CONSERVATION"
  | "STOICHIOMETRY"
  | "THERMO_SIGN"
  | "REFERENCE_PHASE";

export interface StoichiometricReferenceTerm {
  speciesId: string;
  coefficient: number;
}

export interface ChemistryReferenceCase {
  id: string;
  kind: ReferenceCaseKind;
  title: string;
  sourceIds: readonly string[];
  scientificStatus: ScientificStatus;
  reactants?: readonly StoichiometricReferenceTerm[];
  products?: readonly StoichiometricReferenceTerm[];
  expectedThermalClass?: "EXOTHERMIC" | "ENDOTHERMIC" | "NEAR_THERMONEUTRAL";
  expectedDeltaH_JPerMolExtent?: number;
  expectedPhase?: Phase;
  temperatureK?: number;
  pressurePa?: number;
  notes: readonly string[];
}

/**
 * Reference-only fixtures for 06. These encode scientific expectations and
 * stoichiometric identities; they are not reaction lookup rules and contain
 * no experimental procedure or handling instructions.
 */
export const minimumChemistryReferenceCases: readonly ChemistryReferenceCase[] = [
  {
    id: "ref-conservation-h2-o2-h2o",
    kind: "CONSERVATION",
    title: "Hydrogen oxidation atom-balance reference",
    sourceIds: [],
    scientificStatus: "VERIFIED",
    reactants: [
      { speciesId: "H2", coefficient: 2 },
      { speciesId: "O2", coefficient: 1 },
    ],
    products: [{ speciesId: "H2O", coefficient: 2 }],
    notes: ["Graph/stoichiometry invariant only; not evidence that a reaction proceeds under arbitrary conditions."],
  },
  {
    id: "ref-stoich-ch4-combustion",
    kind: "STOICHIOMETRY",
    title: "Methane complete-oxidation stoichiometric reference",
    sourceIds: [],
    scientificStatus: "VERIFIED",
    reactants: [
      { speciesId: "CH4", coefficient: 1 },
      { speciesId: "O2", coefficient: 2 },
    ],
    products: [
      { speciesId: "CO2", coefficient: 1 },
      { speciesId: "H2O", coefficient: 2 },
    ],
    notes: ["Stoichiometric identity only; does not prescribe ignition, apparatus, or operating conditions."],
  },
  {
    id: "ref-thermo-h2-o2-h2o-g",
    kind: "THERMO_SIGN",
    title: "Hydrogen oxidation standard reaction enthalpy sign",
    sourceIds: ["nist-webbook-srd69", "thermochemical-reference-state-definition"],
    scientificStatus: "VERIFIED",
    reactants: [
      { speciesId: "H2", coefficient: 2 },
      { speciesId: "O2", coefficient: 1 },
    ],
    products: [{ speciesId: "H2O", coefficient: 2 }],
    expectedThermalClass: "EXOTHERMIC",
    expectedDeltaH_JPerMolExtent: -483_652,
    temperatureK: REFERENCE_TEMPERATURE_K,
    pressurePa: REFERENCE_PRESSURE_PA,
    notes: [
      "Derived from the pack's phase-compatible standard formation enthalpies at 298.15 K and 1 bar.",
      "Product phase for this reference is H2O(g); it is a thermochemical reference, not an experimental procedure.",
    ],
  },
  {
    id: "ref-thermo-co-oxidation",
    kind: "THERMO_SIGN",
    title: "Carbon monoxide oxidation standard reaction enthalpy sign",
    sourceIds: ["nist-webbook-srd69", "thermochemical-reference-state-definition"],
    scientificStatus: "VERIFIED",
    reactants: [
      { speciesId: "CO", coefficient: 2 },
      { speciesId: "O2", coefficient: 1 },
    ],
    products: [{ speciesId: "CO2", coefficient: 2 }],
    expectedThermalClass: "EXOTHERMIC",
    expectedDeltaH_JPerMolExtent: -565_960,
    temperatureK: REFERENCE_TEMPERATURE_K,
    pressurePa: REFERENCE_PRESSURE_PA,
    notes: ["Derived from NIST WebBook formation enthalpies; reference-only and procedure-free."],
  },
  {
    id: "ref-thermo-ch4-combustion-g",
    kind: "THERMO_SIGN",
    title: "Methane complete oxidation standard reaction enthalpy sign",
    sourceIds: ["nist-webbook-srd69", "thermochemical-reference-state-definition"],
    scientificStatus: "VERIFIED",
    reactants: [
      { speciesId: "CH4", coefficient: 1 },
      { speciesId: "O2", coefficient: 2 },
    ],
    products: [
      { speciesId: "CO2", coefficient: 1 },
      { speciesId: "H2O", coefficient: 2 },
    ],
    expectedThermalClass: "EXOTHERMIC",
    expectedDeltaH_JPerMolExtent: -802_562,
    temperatureK: REFERENCE_TEMPERATURE_K,
    pressurePa: REFERENCE_PRESSURE_PA,
    notes: [
      "Uses H2O(g) and the selected NIST/Manion CH4(g) recommendation recorded in the minimum pack.",
      "Intended for 02/06 thermochemistry validation only; no experimental method is encoded.",
    ],
  },
  ...(["H2", "O2", "N2", "CO", "CO2", "CH4", "NH3"] as const).map(
    (speciesId): ChemistryReferenceCase => ({
      id: `ref-phase-${speciesId.toLowerCase()}-298k-1bar-gas`,
      kind: "REFERENCE_PHASE",
      title: `${speciesId} reference phase at 298.15 K and 1 bar`,
      sourceIds: ["nist-webbook-srd69"],
      scientificStatus: "VERIFIED",
      expectedPhase: "gas",
      temperatureK: REFERENCE_TEMPERATURE_K,
      pressurePa: REFERENCE_PRESSURE_PA,
      notes: ["Simple reference-condition phase check; not a phase-boundary curve."],
    }),
  ),
  {
    id: "ref-phase-h2o-298k-1bar-liquid",
    kind: "REFERENCE_PHASE",
    title: "H2O reference phase at 298.15 K and 1 bar",
    sourceIds: ["nist-webbook-srd69"],
    scientificStatus: "VERIFIED",
    expectedPhase: "liquid",
    temperatureK: REFERENCE_TEMPERATURE_K,
    pressurePa: REFERENCE_PRESSURE_PA,
    notes: ["Simple reference-condition phase check; not a phase-boundary curve."],
  },
];
