import { describe, expect, it } from "vitest";
import { createMatterCompartment, transferMatterBatch, type MatterSystemState } from "../../src/simulation/compartment";
import { evaluateGasTransport, evaluateIdealGasCompartment } from "../../src/simulation/gas-transport";
import { createMoleculeRecord, type ElementDefinition, type ElementProvider, type SpeciesState } from "../../src/simulation/molecular";

const N:ElementDefinition={atomicNumber:7,symbol:"N",atomicMolarMassKgPerMol:.014,valenceElectrons:5,commonOxidationStates:[-3,3,5],electronegativity:3.04,typicalValences:[3]};
const elements:ElementProvider={getElement:s=>s==="N"?N:undefined};
const molecule=createMoleculeRecord({atoms:[{id:"n1",element:"N",formalCharge:0},{id:"n2",element:"N",formalCharge:0}],bonds:[{id:"nn",a:"n1",b:"n2",kind:"covalent",order:3}]},elements);
const phase={phase:"gas" as const,source:"06b",phaseStateId:"gas:06b",scientificStatus:"APPROXIMATED" as const};
const gas=(amountMol:number):SpeciesState=>({id:"N2",amountMol,molecule,phaseState:phase});
const compartment=(id:string,n:number)=>createMatterCompartment({id,kind:"VESSEL_HEADSPACE",volumeM3:.01,species:n>0?[gas(n)]:[]});
const pressure=(s:MatterSystemState,id:string)=>evaluateIdealGasCompartment(s.compartments.find(x=>x.id===id)!,{compartmentId:id,temperatureK:300}).pressurePa??0;

describe("06B combined bulk+diffusion large-dt absolute gate",()=>{
  it("combined enabled mechanisms must not cross pairwise equilibrium",()=>{
    const system:MatterSystemState={compartments:[compartment("A",1),compartment("B",0)],connections:[{id:"A-B",sourceCompartmentId:"A",destinationCompartmentId:"B",kind:"GAS",enabled:true}]};
    const evaluation=evaluateGasTransport({system,thermodynamicInputs:[{compartmentId:"A",temperatureK:300},{compartmentId:"B",temperatureK:300}],connectionModels:[{connectionId:"A-B",bulkMolarConductanceMolPerSPaS:1,diffusiveMolarConductanceMolPerSPaS:1,scientificStatus:"APPROXIMATED",source:"06b"}],dtS:1e9});
    const result=transferMatterBatch(system,evaluation.transferRequests);
    expect(result.status).toBe("COMMITTED");
    if(result.status!=="COMMITTED") return;
    expect(pressure(result.state,"A")).toBeGreaterThanOrEqual(pressure(result.state,"B"));
  });
});
