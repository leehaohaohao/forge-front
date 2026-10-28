# 自助迁移前2：自动分片与续跑验收

2026-10-28。依据 WSL 后端 `docs/vault-self-service-migration-plan.md` 的前2，以及后2 `9d97585` 的 API/JWE 契约实施。前1基线 `868466b`。本阶段本地提交，完整功能完成后统一提 PR。

## 实现

- 复用现有 `VaultSession` / 保险库 Worker，不创建第二份业务密钥；`selfRecipient` 在同一个 Worker 生成不可导出 RSA 私钥，主线程只接收公开 JWK/指纹。`selfMigrate` 一次消费该接收密钥，失败后需新交付会话。
- `self-migration.ts` 按固定快照顺序获取 JWE 分片，检查上下文、有效期、重复片、完整加密内部 manifest、元数据/版本/软删除和全量计数。最多 2000 条、累计 8 MiB、每片最多 100 条/1 MiB，逐片清除解密缓冲与源值引用。
- 每片复用 format v1：stage → GET 实际存储密文 → 解密与原始 Unicode 字符串精确比较 → receipt。输入经过合法 UTF-8 往返校验，不 trim 或规范化，等价于原始字节相等。
- 每次续跑先读取全部暂存包。已暂存项不生成新 secret_id/nonce；已有 receipt 也必须重新取源并解密核对。最终再次检查完整集合、唯一 secret_id、实际包摘要和回执，然后生成仅基于密文的最终清单。
- `SelfMigrationClient` 封装新建/替换交付会话和处理桥接。创建/会话使用 `X-Vault-Reauth`，源/stage/receipt/finalize 使用 `X-Vault-Migration-Authorization`。任务授权只存在主线程内存，不传入 Worker，不复用旧 M1 写入路径。账号身份确认后立即清空调用方密码对象；不自动反复重认证。
- 网络错误最多重试三次（1/2/4 秒），429 遵循 Retry-After。stage/receipt 未知结果先读取进度，再以相同 request_id 和密文重放。finalize 未知结果只查任务，不重复提交；accepted 与 completed 分开。
- 服务端 Date 校准 JWE 时间，不依赖用户本地系统时钟。相同源响应加入的 `server_now` 仅为主线程到 Worker 内部数据，不是新增后端字段。缺失 Date 失败关闭；同源部署可读，跨域部署需暴露 Date。
- 手动锁定、隐藏、离页和无操作超时沿用现有策略，终止 Worker、清除内存授权并 abort 请求。旧 Worker 回调不能更新新会话。后台请求和进度不刷新用户活动计时。固定文案区分授权到期、其他页面替换租约和功能未开放。

## 已运行验证

| 验证 | 结果 |
| --- | --- |
| `node scripts/test-self-migration.mjs` | 34 项通过：201 条跨 3 片、混合软删除、前后空白/组合 Unicode；2000 条且实际分片累计恰好 8 MiB；越界、错误 UTF-8/manifest、实际业务包篡改、断网/429 有界重试、stage/receipt/finalize 响应丢失、换密钥续跑、已验证项重新比较、任务头/路由白名单和密码清理 |
| `node scripts/test-self-processing-browser.cjs` | Windows Chrome、真实现有 Worker：201 条；首片已回执后锁定取消在途源请求；真实 document reload 后恢复服务端合成状态，新 Worker 仅写剩余 101 条；所有回执存在时仍取回三片；无操作超时、隐藏事件和 Worker dispose 终止请求 |
| Worker/请求边界检查 | 迁移期间 Worker 返回值和业务请求不含合成源值/legacy_value/私钥；localStorage/sessionStorage 未写入迁移内容。测试初始化与后端合成源生成不计作迁移跨边界数据 |
| `npm run build` | TypeScript 与正式构建通过；保留既有大包警告 |
| `npm run test:vault` | 密码学向量、版本、篡改、凭据重包装回归通过 |
| `node scripts/test-migration-bridge.mjs` / `test-migration-source.mjs` / `test-vault-migration.mjs` | 旧 M1 桥接、来源校验、201 条、幂等/限流/备份回归通过 |

浏览器测试入口为 `tests/vault/self-processing.html`，开发服务器端口 3013；仅测试入口，非正式构建入口。所有资料均为公开合成数据。隐藏测试主动派发 visibilitychange，未将其描述为原生窗口切换验收。租约替换/授权到期验证使用固定 40911/40101 响应；未宣称两个物理设备或真实服务端并发验收。

## 后续交接与限制

正式 MigrationPanel 入口仍关闭。本次 controller 已可供后3/前3接线，不绕过能力诊断；实际默认后端和 finalize 仍为 40910。finalize 的接受及响应丢失仅用合成 transport 验证，不执行真实切换，不宣称迁移完成。

后3需实现真实 finalize、持久切换/审计和旧任务接续。前3再将 controller 接入用户操作区、状态轮询和统一错误展示，完成真实页面 → 后端 HTTP → 隔离 MySQL → 保护备份/恢复 → Worker → 切换审计联合验收。当前浏览器测试是真实加密 Worker + 合成服务，不能代替该闭环。

未更改生产开关、业务库、备份保留或部署配置；未自动合并或发布。
