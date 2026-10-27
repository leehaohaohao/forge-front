/// <reference lib="webworker" />
import {parseBackup,BACKUP_LIMIT} from './backup-file';
import {strictJson} from './migration-source';
import {digest,unlock,verifyBackup} from './migration-core';
import {requireThat,validateRecovery} from './format';
// One fresh Worker per verification: no session key, RPC, network, or persistent state.
self.onmessage=async({data})=>{
  let bytes:Uint8Array|undefined,material:any;
  try{
    requireThat(data.backup instanceof Blob&&data.backup.size>0&&data.backup.size<=BACKUP_LIMIT);
    requireThat(data.recovery instanceof Blob&&data.recovery.size>0&&data.recovery.size<=4096);
    requireThat(data.checksum instanceof Blob&&data.checksum.size>0&&data.checksum.size<=256);
    bytes=new Uint8Array(await data.backup.arrayBuffer());const hash=await digest(bytes);
    requireThat(hash===(await data.checksum.text()).trim());
    const backup=parseBackup(strictJson(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));
    material=strictJson(await data.recovery.text());validateRecovery(material);
    requireThat(material.user_id===backup.user_id&&material.vault_id===backup.vault.vault_id);
    const key=await unlock(backup.vault,material.recovery_key,true);material.recovery_key='';
    const result=await verifyBackup(backup.vault,backup.records,key,backup.user_id,backup.record_count,backup.legacy_pending_count);
    self.postMessage({ok:true,result:{...result,export_id:backup.export_id,sha256:hash,checked_at:new Date().toISOString()}});
  }catch{self.postMessage({ok:false});}
  finally{bytes?.fill(0);if(material)material.recovery_key='';self.close();}
};
