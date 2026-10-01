/** Stable account assignment. Only an experiment ID and host-authorized subject
 * enter the hash. Never expose the subject key as an analytics dimension. */
export const experimentVariant = async (experimentId: string, subject: string): Promise<'a'|'b'> => {
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([experimentId,subject])));
  return new Uint8Array(bytes)[0] < 128 ? 'a' : 'b';
};
export const conversionInterval = (successes:number,total:number) => {
  if(!Number.isInteger(successes)||!Number.isInteger(total)||successes<0||total<successes) throw new Error('Invalid experiment counts');
  if(!total)return null;
  const z=1.959963984540054, rate=successes/total, denominator=1+z*z/total;
  const center=(rate+z*z/(2*total))/denominator;
  const radius=z*Math.sqrt(rate*(1-rate)/total+z*z/(4*total*total))/denominator;
  return {low:Math.max(0,center-radius),high:Math.min(1,center+radius),rate};
};
export const experimentEvidence = (input:{exposuresA:number;exposuresB:number;matureA:number;matureB:number;convertedA:number;convertedB:number}) => {
  const a=conversionInterval(input.convertedA,input.matureA),b=conversionInterval(input.convertedB,input.matureB);
  if(!Number.isInteger(input.exposuresA)||!Number.isInteger(input.exposuresB)||input.exposuresA<input.matureA||input.exposuresB<input.matureB)throw new Error('Invalid exposure counts');
  const total=input.exposuresA+input.exposuresB;
  const ratioMismatch=total>=100 && ((input.exposuresA-total/2)**2+(input.exposuresB-total/2)**2)/(total/2)>6.635;
  const ready=input.matureA>=100&&input.matureB>=100&&!ratioMismatch;
  // Conservative descriptive separation, NOT a sequential test or a license to
  // stop early. Hosts report the predeclared fixed outcome window and duration.
  const separation=ready&&a&&b ? b.low>a.high ? 'b-higher' as const : a.low>b.high ? 'a-higher' as const : 'overlapping' as const : 'insufficient' as const;
  return {a,b,ratioMismatch,ready,separation};
};
