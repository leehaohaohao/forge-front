import { isAxiosError } from 'axios';
import { VaultError } from './types';
export function vaultMessage(error:unknown) {
  if(isAxiosError(error)) {
    const code=error.response?.data?.code;
    if(error.response?.status===409) return code===40903?'历史记录待迁移，暂时不能查看、复制或替换。':'数据已变更或提交结果不确定，已刷新列表。请核对后重新操作，不会自动覆盖。';
    if(code===40101) return '请重新验证账号身份，账号密码与保险库密码不同。';
    if(error.response?.status===429) return '请求过于频繁，请稍后重试。';
    if(error.response?.status===404) return '记录已删除或不可用，请刷新列表。';
    if(error.code==='ERR_CANCELED') return '操作已取消，临时内容已清理。';
    return '请求未完成，请检查连接后刷新核对结果。不会自动重试写入。';
  }
  if(error instanceof VaultError) {
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
