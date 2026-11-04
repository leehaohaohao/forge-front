import {requireThat} from './format';
import {VaultError} from './types';
export function strictJson(text:string):any {
  let i=0;
  const ws=()=>{while(/\s/.test(text[i]??'')&&i<text.length)i++;};
  const string=()=>{const start=i++;while(i<text.length){if(text[i]==='\\'){i+=2;continue;}if(text[i++]==='"')return JSON.parse(text.slice(start,i));}throw new VaultError('INVALID_FORMAT');};
  const value=(depth:number):any=>{
    requireThat(depth<16);ws();
    if(text[i]==='"')return string();
    if(text[i]==='{'){
      i++;ws();const result=Object.create(null),keys=new Set();if(text[i]==='}'){i++;return result;}
      while(i<text.length){requireThat(text[i]==='"');const key=string();requireThat(!keys.has(key));keys.add(key);ws();requireThat(text[i++]===':');result[key]=value(depth+1);ws();if(text[i]==='}'){i++;return result;}requireThat(text[i++ ]===',');ws();}
    }else if(text[i]==='['){i++;ws();const result:any[]=[];if(text[i]===']'){i++;return result;}while(i<text.length){result.push(value(depth+1));ws();if(text[i]===']'){i++;return result;}requireThat(text[i++ ]===',');}}
    else {const m=text.slice(i).match(/^(?:true|false|null|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)/);requireThat(m);i+=m[0].length;return JSON.parse(m[0]);}
    throw new VaultError('INVALID_FORMAT');
  };
  const result=value(0);ws();requireThat(i===text.length);return result;
}
