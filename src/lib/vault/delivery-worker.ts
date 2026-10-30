/// <reference lib="webworker" />
import {recipient,DeliveryReceiver} from './delivery';
let receiver:DeliveryReceiver|undefined;let chain=Promise.resolve();
self.onmessage=({data})=>{chain=chain.then(async()=>{try{
 if(data.action==='generate'){const pair=await recipient();receiver=new DeliveryReceiver(pair.privateKey,pair.recipient);self.postMessage({id:data.id,ok:true,publicKey:pair.publicKey,recipient:pair.recipient});}
 else if(data.action==='inspect'&&receiver){const bytes=await receiver.open(data.jwe,data.context,data.now);try{self.postMessage({id:data.id,ok:true,bytes:bytes.length});}finally{bytes.fill(0);}}
 else throw new Error();
}catch{receiver=undefined;self.postMessage({id:data.id,ok:false,code:'DELIVERY_INVALID'});}});};
