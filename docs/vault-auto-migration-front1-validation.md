# 自动迁移精简方案：前1实现与定向验证

日期：2026-11-02。前端分支 codex/auto-migration-front1，基于已合并 PR #11 的 main（9164a0b）。按后端 a64063a 交付的 vault-legacy-migration-api.md 实现。此记录是前1定向验证，不替代计划中的真实联合验收或后2删表验收。

## 实现

- 正常密钥页改用日常 GET /vault 读取创建/解锁状态，卸载四步向导、来源诊断、申请/确认、文件迁移和旧状态/完成任务轮询。去掉迁移专属登录密码和影响确认；退出仅清理本地登录/保险库，不再请求旧 self-service-session/revoke。
- 创建并验证恢复材料后、已有保险库解锁后，独立 AutoMigration 挂载自动调度。进度为一行“正在整理历史密钥 x/y”，说明放圆形帮助浮层；完成/零条/兼容关闭时收起，最终异常提供重试。自动迁移不占用日常操作 busy，不冻结已加密密钥或全账户。
- 临时模块位于 src/lib/legacy-migration、src/services/legacy-migration.ts 和 AutoMigration.tsx；只请求 status/source/commit，不依赖旧 F1、readiness、task、batch、lease、grant 或 VITE 迁移开关。404/410 视为模块退役，401/429/5xx 不误当关闭。
- 复用现有保险库 Worker，增加独立 legacyRecipient/legacyConvert/legacyClear RPC；RSA3072 私钥不导出，仅在 Worker 内存。新协议独立校验 typ、crit、三处 binding、登录身份、保险库/凭据版本、行 revision、公钥指纹和有效期。AES-GCM 使用原始 protected header 文本作 AAD。
- 原始 UTF-8 字节长度/hash 校验后，按 Scheme B 生成新 secret ID/DEK/nonce；通过实际包装解开 DEK，再回解并逐字节比较，只有成功才返回密文提交体。BOM、NUL、组合字符和纯空白不做归一化；日常解密读取同样保留 BOM/空白。正常新建秘密的既有输入限制未变。
- 串行提交、游标分页包含软删除且不受列表筛选影响。单行损坏记录错误后继续其他行；40902 重读、重新加密并有限重试；网络/5xx 退避；status/source/commit 的429遵守 Retry-After，等待期间无可绕过退避的手动按钮。
- 提交响应丢失先重读该 ID 的 pending 状态；确认不再待迁移则跳过，否则等待后原包重试。结束必须重新无游标统计全部 pending/unsupported，仅两者都为零才完成。
- 锁定、离页、退出、账号变化终止请求和调度，已提交事务依真实状态续传。自动 Worker RPC 不延长用户空闲计时。正常创建、恢复材料验证、改凭据、导出及独立恢复页保留。

旧迁移实现/实验夹具尚有未挂载文件，留给计划后2的复杂链路清理；本次不声称已完成全部旧代码删除、删表或最终兼容层退役。正常应用入口不再调用它们。

## 验证

- npm run build：通过；保留已有大 chunk 提示。没有设置 VITE 迁移开关，也没有修改忽略的本地配置。
- node scripts/test-legacy-migration.mjs：通过。用后端公开 Go JWE 向量和独立生成包验证新转换实现；覆盖身份/版本/删除状态绑定、tag 篡改、过期、不可导出私钥、BOM/NUL/空白逐字节回解。调度覆盖严格状态解析、分页/软删除、单条失败继续、丢响应后核对、冲突、读取与提交的429等待、中止、零条和关闭。
- node scripts/test-vault.mjs：通过。既有 KDF/AAD/包装/密文固定向量、错误密码/恢复密钥、篡改及凭据重新包装回归。
- scripts/test-auto-migration-browser.cjs：Windows Chrome 无头 + 实际 React 页面/日常 Worker，HTTP 为明确模拟的 API。覆盖已有保险库解锁自动转换、单条422其他继续、软删除、提交成功但响应丢失、真实密文原值核对、锁定取消迟到响应/重新解锁续传、身份变化中止、429等待、退出清理；新用户实际创建/下载/验证恢复材料后直接新增；关闭和退役仍可正常新增。断言没有旧迁移 API 或迁移专属 reauth 请求。
- 浏览器复现：WSL npm run dev -- --port 3015 --strictPort --host 0.0.0.0；设置可用 Playwright/Chrome 后运行上述脚本（VAULT_PAGE_URL 可覆盖地址）。公开 fixture 中的私钥/密码仅测试用途。

## 后续边界

真实 Go/MySQL 前后端联合验收由计划下一阶段执行，尤其是多标签页并发、实际网络中断和事务落库、正常新增/复制/导出/恢复与迁移同时进行。后2还需停用旧执行器、清理旧表/触发器及旧 gate 依赖；当前后端如仍存在旧活动任务，接口可能返回409，前端保留原数据并提示重试，不自行强制解锁。没有读取或迁移真实用户秘密，没有执行来源登记、SQL清理或生产部署。