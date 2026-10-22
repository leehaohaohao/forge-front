import { create } from 'zustand';
import { getTokens } from '@/services/token';
import type { Token, TokenQueryParams } from '@/types/token';
let request=0;
let pending:AbortController | undefined;
interface TokenState {
  tokens:Token[]; loading:boolean; pagination:{current:number;pageSize:number;total:number};
  fetchTokens:(params?:TokenQueryParams)=>Promise<void>;
  clear:()=>void;
  setPagination:(p:Partial<{current:number;pageSize:number}>)=>void;
}
export const useTokenStore=create<TokenState>((set,get)=>({
  tokens:[],loading:false,pagination:{current:1,pageSize:10,total:0},
  async fetchTokens(params) {
    pending?.abort(); pending=new AbortController(); const signal=pending.signal, id=++request;
    set({loading:true});
    try {
      const p=get().pagination;
      const result=await getTokens({page:p.current,page_size:p.pageSize,...params},signal);
      if(id===request) set({tokens:result.data,pagination:{...p,total:result.total}});
    } catch(e) { if(!signal.aborted) throw e; }
    finally { if(id===request) set({loading:false}); }
  },
  clear(){ ++request; pending?.abort(); set({tokens:[],loading:false,pagination:{current:1,pageSize:10,total:0}}); },
  setPagination(p){set(s=>({pagination:{...s.pagination,...p}}));},
}));
