import { ApiError, apiErrorMessage } from '../api-error';
import { VaultError } from './types';
export function vaultMessage(error:unknown) {
  if(error instanceof ApiError) {
    const code=error.businessCode;
    if(code===40906)return '记录迁移中，请等待管理员处理；已有密文仍可读取。';
    if(code===40901)return '请先初始化保险库，请刷新准备状态后继续。';
    if(code===40905)return '保险库已达到写入上限，请联系维护人员。';
    if(error.kind==='conflict') return code===40903?'历史记录待迁移，暂时不能查看、复制或替换。':'数据已变更或提交结果不确定，已刷新列表。请核对后重新操作，不会自动覆盖。';
    if(code===40101) return '请重新验证账号身份，账号密码与保险库密码不同。';
    if(error.kind==='rate-limit') return '请求过于频繁，请稍后重试。';
    if(error.kind==='not-found') return '记录已删除或不可用，请刷新列表。';
    if(error.kind==='canceled') return '操作已取消，临时内容已清理。';
    return apiErrorMessage(error);
  }
  if(error instanceof VaultError) {
    if(error.code==='MIGRATION_LIMIT')return '网页支持最多8 MiB、2000条记录。较大文件请联系管理员使用受支持的本地迁移工具。';
    if(error.code==='MIGRATION_NETWORK')return '迁移请求结果暂时无法确认。请重新读取任务后重试，已提交的数据会从服务端核对。';
    if(error.code==='MIGRATION_AUTH')return '账号身份确认失败，请检查账号登录密码；它不是保险库独立密码。';
    if(error.code==='MIGRATION_CONFLICT')return '迁移状态已变化，请刷新任务后继续，不能覆盖其他会话的处理结果。';
    if(error.code==='MIGRATION_RATE_LIMIT')return '等待次数已达上限，迁移已停止。请稍后刷新任务并继续。';

    if(error.code==='UNLOCK_FAILED') return '无法解锁，请检查密码或使用恢复材料';
    if(error.code==='INVALID_PASSWORD') return '请使用至少12个字符、最多1024字节的独立长口令。';
    if(error.code==='LOCKED') return '请先解锁保险库，再重新执行操作。';
    if(error.code==='STALE') return '会话或数据已变化，请重新解锁或刷新后重试。';
    if(error.code==='KEY_LIMIT') return '保险库已达到写入上限，仍可读取和编辑元数据。';
    if(error.code==='UNSUPPORTED') return '浏览器不支持所需加密能力，请使用支持 HTTPS、Web Crypto、Worker 和 WASM 的浏览器。';
    if(error.code==='RECOVERY_UNVERIFIED') return '请先下载并重新输入验证恢复材料。';
  }
  return '操作未完成：输入或密文校验失败。请检查输入；业务密钥须为非空、最多8192字节，保留原始空格。';
}
