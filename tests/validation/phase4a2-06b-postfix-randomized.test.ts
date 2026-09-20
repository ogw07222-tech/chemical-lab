import { describe, expect, it } from "vitest";
import { aggregateSystemMatterInventory, createMatterCompartment, transferMatterBatch, type MatterSystemState } from "../../src/simulation/compartment";
import { evaluateGasTransport, evaluateIdealGasCompartment, type GasConnectionTransportModel } from "../../src/simulation/gas-transport";
import { createMoleculeRecord, type ElementDefinition, type ElementProvider, type SpeciesState } from "../../src/simulation/molecular";

const N:ElementDefinition={atomicNumber:7,symbol:"N",atomicMolarMassKgPerMol:.014,valenceElectrons:5,commonOxidationStates:[-3,3,5],electronegativity:3.04,typicalValences:[3]};
const O:ElementDefinition={atomicNumber:8,symbol:"O",atomicMolarMassKgPerMol:.016,valenceElectrons:6,commonOxidationStates:[-2],electronegativity:3.44,typicalValences:[2]};
const ep:ElementProvider={getElement:s=>({N,O} as Record<string,ElementDefinition>)[s]};
const n2=createMoleculeRecord({atoms:[{id:"n1",element:"N",formalCharge:0},{id:"n2",element:"N",formalCharge:0}],bonds:[{id:"nn",a:"n1",b:"n2",kind:"covalent",order:3}]},ep);
const o2=createMoleculeRecord({atoms:[{id:"o1",element:"O",formalCharge:0},{id:"o2",element:"O",formalCharge:0}],bonds:[{id:"oo",a:"o1",b:"o2",kind:"covalent",order:2}]},ep);
const phase={phase:"gas" as const,source:"06b-postfix",phaseStateId:"gas:06b-postfix",scientificStatus:"APPROXIMATED" as const};
const gas=(id:string,n:number,m=n2):SpeciesState=>({id,amountMol:n,molecule:m,phaseState:phase});
const c=(id:string,n:number,o:number,v:number)=>createMatterCompartment({id,kind:"VESSEL_HEADSPACE",volumeM3:v,species:[gas("N2",n),gas("O2",o,o2)].filter(x=>x.amountMol>0)});
const model=(id:string,b:number,d:number):GasConnectionTransportModel=>({connectionId:id,bulkMolarConductanceMolPerSPaS:b,diffusiveMolarConductanceMolPerSPaS:d,scientificStatus:"APPROXIMATED",source:"06b-postfix"});
const rnd=(seed:number)=>{let x=seed>>>0;return()=>((x=(1664525*x+1013904223)>>>0)/0x100000000)};
function evalP(s:MatterSystemState,temps:Record<string,number>){return new Map(s.compartments.map(x=>[x.id,evaluateIdealGasCompartment(x,{compartmentId:x.id,temperatureK:temps[x.id]!})] as const));}
function commit(s:MatterSystemState,e:ReturnType<typeof evaluateGasTransport>){if(!e.transferRequests.length)return s;const r=transferMatterBatch(s,e.transferRequests);expect(r.status).toBe("COMMITTED");if(r.status!=="COMMITTED")throw new Error("commit");return r.state;}
function inv(s:MatterSystemState){return aggregateSystemMatterInventory(s);}
function sameInv(a:ReturnType<typeof inv>,b:ReturnType<typeof inv>){expect(a.speciesAmountsMol).toEqual(b.speciesAmountsMol);expect(a.elementsMol).toEqual(b.elementsMol);expect(a.atomAmountMol).toBeCloseTo(b.atomAmountMol,11);expect(a.netChargeAmountMol).toBeCloseTo(b.netChargeAmountMol,11);}

describe("06B post-fix randomized invariant closure",()=>{
 it("fixed-seed randomized semantic permutations stay finite, conservative, diagnostic-consistent and do not cross enabled-edge pressure envelopes",()=>{
  const r=rnd(0x4a206b);
  for(let k=0;k<80;k++){
   const va=.002+r()*.03,vb=.002+r()*.03,vc=.002+r()*.03;
   const comps=[c("A",r(),r(),va),c("B",r(),r(),vb),c("C",r(),r(),vc)];
   const connections=[
    {id:"A-B",sourceCompartmentId:"A",destinationCompartmentId:"B",kind:"GAS" as const,enabled:true},
    {id:"A-C",sourceCompartmentId:"A",destinationCompartmentId:"C",kind:"GAS" as const,enabled:true},
    {id:"B-C",sourceCompartmentId:"B",destinationCompartmentId:"C",kind:"GAS" as const,enabled:true},
   ];
   const temps={A:220+r()*500,B:220+r()*500,C:220+r()*500};
   const models=connections.map(x=>model(x.id,r()*1e-4,r()*1e-4));
   const dtS=10**(-10+r()*20);
   const input={system:{compartments:comps,connections} satisfies MatterSystemState,thermodynamicInputs:Object.entries(temps).map(([compartmentId,temperatureK])=>({compartmentId,temperatureK})),connectionModels:models,dtS};
   const beforeP=evalP(input.system,temps);
   const e=evaluateGasTransport(input);
   const perm=evaluateGasTransport({system:{compartments:[...comps].reverse().map(x=>({...x,species:[...x.species].reverse()})),connections:[...connections].reverse()},thermodynamicInputs:[...input.thermodynamicInputs].reverse(),connectionModels:[...models].reverse(),dtS});
   expect(perm).toEqual(e);
   for(const q of e.transferRequests.flatMap(x=>x.species))expect(Number.isFinite(q.amountMol)&&q.amountMol>=0).toBe(true);
   for(const d of e.diagnostics){const final=e.bulkTransfers.find(x=>x.connectionId===d.connectionId)?.species.reduce((s,x)=>s+x.amountMol,0)??0;expect(d.boundedBulkAmountMol??0).toBeCloseTo(final,12);}
   const before=inv(input.system);const next=commit(input.system,e);sameInv(inv(next),before);
   const afterP=evalP(next,temps);
   for(const edge of connections){
    const bpS=beforeP.get(edge.sourceCompartmentId)!,bpD=beforeP.get(edge.destinationCompartmentId)!,apS=afterP.get(edge.sourceCompartmentId)!,apD=afterP.get(edge.destinationCompartmentId)!;
    const initial=(bpS.pressurePa??0)-(bpD.pressurePa??0),final=(apS.pressurePa??0)-(apD.pressurePa??0);
    if(initial>0)expect(final).toBeGreaterThanOrEqual(-1e-7); else if(initial<0)expect(final).toBeLessThanOrEqual(1e-7);
    for(const sid of ["N2","O2"]){const ip=(bpS.partialPressuresPa[sid]??0)-(bpD.partialPressuresPa[sid]??0),fp=(apS.partialPressuresPa[sid]??0)-(apD.partialPressuresPa[sid]??0);if(ip>0)expect(fp).toBeGreaterThanOrEqual(-1e-7);else if(ip<0)expect(fp).toBeLessThanOrEqual(1e-7);}
   }
  }
 });
 it("same-step incoming gas cannot fund downstream outgoing transfer",()=>{
  const system:MatterSystemState={compartments:[c("A",1,0,.01),c("B",0,0,.01),c("C",0,0,.01)],connections:[
   {id:"A-B",sourceCompartmentId:"A",destinationCompartmentId:"B",kind:"GAS",enabled:true},
   {id:"B-C",sourceCompartmentId:"B",destinationCompartmentId:"C",kind:"GAS",enabled:true},
  ]};
  const e=evaluateGasTransport({system,thermodynamicInputs:["A","B","C"].map(compartmentId=>({compartmentId,temperatureK:300})),connectionModels:[model("A-B",1,1),model("B-C",1,1)],dtS:1e12});
  expect(e.transferRequests.some(x=>x.sourceCompartmentId==="B"&&x.destinationCompartmentId==="C")).toBe(false);
 });
 it("missing connection model is explicit OPEN and invents no conductance",()=>{
  const system:MatterSystemState={compartments:[c("A",1,0,.01),c("B",0,0,.01)],connections:[{id:"A-B",sourceCompartmentId:"A",destinationCompartmentId:"B",kind:"GAS",enabled:true}]};
  const e=evaluateGasTransport({system,thermodynamicInputs:["A","B"].map(compartmentId=>({compartmentId,temperatureK:300})),connectionModels:[],dtS:1});
  expect(e.transferRequests).toEqual([]);expect(e.diagnostics[0]?.scientificStatus).toBe("OPEN");expect(e.diagnostics[0]?.reasonCodes).toContain("MISSING_CONNECTION_MODEL");
 });
 it("zero and trace inventories remain finite and non-negative",()=>{
  const system:MatterSystemState={compartments:[c("A",1e-18,0,.01),c("B",0,0,.01)],connections:[{id:"A-B",sourceCompartmentId:"A",destinationCompartmentId:"B",kind:"GAS",enabled:true}]};
  for(const dtS of [1e-12,1,1e12,1e300]){const e=evaluateGasTransport({system,thermodynamicInputs:["A","B"].map(compartmentId=>({compartmentId,temperatureK:300})),connectionModels:[model("A-B",1,1)],dtS});for(const x of e.transferRequests.flatMap(q=>q.species))expect(Number.isFinite(x.amountMol)&&x.amountMol>=0&&x.amountMol<=1e-18).toBe(true);}
 });
});