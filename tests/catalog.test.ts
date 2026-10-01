import {expect, test} from 'bun:test';
import {defineTrackingCatalog, validateTrackingEvent, trackingCoverage} from '../src/catalog';
const definition = {event:'workflow.completed',version:1,label:'Completed',owner:'Product',source:'server' as const,consent:false,retentionDays:90,meaning:'Committed completion',fields:{count:{kind:'number' as const,required:true,minimum:0,maximum:10}}};
const catalog = defineTrackingCatalog([definition]);
test('versioned schema rejects malformed events without echoing submitted values',()=>{
 expect(validateTrackingEvent(catalog,'workflow.completed',1,{count:2})).toBeNull();
 expect(validateTrackingEvent(catalog,'workflow.completed',2,{count:2})).toBe('unsupported-version');
 expect(validateTrackingEvent(catalog,'other',1,{})).toBe('unknown-event');
 expect(validateTrackingEvent(catalog,'workflow.completed',1,{count:NaN})).toBe('invalid-field');
 expect(validateTrackingEvent(catalog,'workflow.completed',1,{})).toBe('missing-field');
 expect(validateTrackingEvent(catalog,'workflow.completed',1,{count:2,password:'private'})).toBe('unknown-field');
 expect(()=>defineTrackingCatalog([definition,definition])).toThrow();
 definition.fields.count.maximum=0;
 expect(validateTrackingEvent(catalog,'workflow.completed',1,{count:2})).toBeNull();
});
test('absence only implies missing collection when explicitly expected',()=>{
 const input={startedAt:0,lastReceivedAt:null,asOf:100,staleAfterMs:50,expected:false};
 expect(trackingCoverage(input)).toBe('awaiting-data');
 expect(trackingCoverage({...input,expected:true})).toBe('missing');
 expect(trackingCoverage({...input,lastReceivedAt:120})).toBe('invalid-clock');
 expect(trackingCoverage({...input,lastReceivedAt:10})).toBe('observed');
 expect(trackingCoverage({...input,lastReceivedAt:10,expected:true})).toBe('stale');
});
