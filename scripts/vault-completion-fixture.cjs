exports.completedTask=status=>{
 const {created_at,updated_at,...batch}=status.latest_batch;
 return {task_id:'77777777-7777-4777-8777-777777777777',user_id:status.user_id,vault_id:status.vault.vault_id,state:'completed',revision:'12',batch,operator_id:'42',failure_code:null,next_action:'operator_backup',frozen:false,can_cancel:false,source_exported_at:created_at,delivered_at:created_at,created_at,updated_at,switched_at:updated_at,audit_complete:true,audited_at:updated_at,completed_at:updated_at,backup_id:null,backup_state:'pending',backup_exported_at:null,recovery_state:'pending',recovery_checked_at:null,files_disposed_at:null};
};
