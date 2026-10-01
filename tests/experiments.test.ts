import {expect,test} from 'bun:test';
import {experimentVariant,experimentEvidence} from '../src/experiments';
test('assignment is stable across devices and execution order',async()=>{
 const assigned=await Promise.all(Array.from({length:1000},(_,index)=>experimentVariant('trial',String(index))));
 expect(assigned[42]).toBe(await experimentVariant('trial','42'));
 const a=assigned.filter(value=>value==='a').length;expect(a).toBeGreaterThan(400);expect(a).toBeLessThan(600);
});
test('small samples and mismatched allocation do not claim a winner',()=>{
 expect(experimentEvidence({exposuresA:10,exposuresB:10,matureA:10,matureB:10,convertedA:0,convertedB:10}).separation).toBe('insufficient');
 expect(experimentEvidence({exposuresA:1000,exposuresB:100,matureA:1000,matureB:100,convertedA:0,convertedB:100}).ratioMismatch).toBe(true);
 expect(experimentEvidence({exposuresA:100,exposuresB:100,matureA:100,matureB:100,convertedA:10,convertedB:80}).separation).toBe('b-higher');
 expect(()=>experimentEvidence({exposuresA:10,exposuresB:10,matureA:20,matureB:10,convertedA:0,convertedB:0})).toThrow();
});
