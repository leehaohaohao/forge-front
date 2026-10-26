exports.statusFor=(vault,user='9007199254740993')=>({
 user_id:user,initialized:!!vault,vault:vault?{format_version:1,vault_id:vault.vault_id,revision:vault.revision,vault_key_version:1,credential_version:vault.credential_version}:null,
 counts:{legacy_active:0,legacy_deleted:0,encrypted:0},has_migration_history:false,migration_required:false,frozen:false,encrypted_only:false,active_batch:null,latest_batch:null,
 audit:{state:'not_applicable',complete:false,checked_at:null,switched_at:null},
 operations:Object.fromEntries(['initialize_vault','create_token','replace_secret','edit_metadata','delete_token','update_credentials','read_encrypted','export_encrypted','request_migration'].map(k=>{
   const allowed=k==='request_migration'?false:k==='initialize_vault'?!vault:['edit_metadata','delete_token'].includes(k)||!!vault;
   return [k,{allowed,reason:allowed?null:k==='request_migration'?'not_supported':k==='initialize_vault'?'vault_already_initialized':'vault_not_initialized'}];
 }))
});
