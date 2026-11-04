import {requireThat} from './format';
export class RateLimitError extends Error {
  constructor(public retryAfterMs:number) { super('RATE_LIMITED'); }
}
export function retryAfterMs(header:string|null,now=Date.now()) {
  if(header && /^\d+$/.test(header)) return Math.max(1000,Number(header)*1000);
  const date=header?Date.parse(header):NaN;
  return Number.isFinite(date)?Math.max(1000,date-now):60000;
}
export async function retryRateLimit<T>(action:()=>Promise<T>,sleep=(ms:number)=>new Promise<void>(r=>setTimeout(r,ms))) {
  for(let attempt=0;;attempt++) {
    try {return await action();} catch(error) {
      if(!(error instanceof RateLimitError) || attempt>=8) throw error;
      // Reject unreasonable waits rather than overflowing setTimeout and retrying early.
      requireThat(Number.isFinite(error.retryAfterMs)&&error.retryAfterMs>=0&&error.retryAfterMs<=86400000);
      await sleep(error.retryAfterMs);
    }
  }
}
