// Capture the old bearer before local cleanup. Use an isolated request so a late
// response cannot clear a newer login through the global response interceptor.
export async function revokeLogoutSession(token:string):Promise<boolean>{
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),5000);
 try{const r=await fetch('/forge/vault/self-service-session/revoke',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{}',signal:controller.signal,keepalive:true,cache:'no-store'});return r.ok&&(await r.json()).code===0;}catch{return false;}finally{clearTimeout(timer);}
}
