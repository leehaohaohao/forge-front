import type {VaultFailure} from './types';
export type MigrationRequest={kind:'reauth'}|{kind:'api';path:string;body?:unknown};
export type MigrationReply={ok:true;value:unknown}|{ok:false;code:VaultFailure;retryAfterMs?:number};
export type MigrationProgress={staged:number;verified:number;total:number;waitingUntil?:number};
export type MigrationHost=(request:MigrationRequest)=>Promise<MigrationReply>;
