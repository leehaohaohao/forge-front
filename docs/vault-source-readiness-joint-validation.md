# 来源就绪修复联合验收（2026-11-02）

结论：**暂不通过，暂不提汇总 PR**。前端定向回归通过，UTC 部署的真实链路通过；非 UTC Go 进程存在阻塞迁移的后端时间解释问题，需修复后复验。

## 版本与隔离边界

- 前端：`codex/source-readiness-front2`，`8b8581d`（含前1 `a0486e6`）。
- 后端：`28bfec1`。
- Windows Chrome 无头浏览器，真实生产前端、Worker、Go HTTP、两套各自独立的 MySQL 8.4 主库/恢复库。
- 数据均由 `scripts/test-vault-source-deployment.py --keep` 新建，11 条合成历史值，含 1 条软删除；未操作业务库的真实 11 条记录。
- 为 HTTP 验收补齐合成 users 表字段及测试账号；应用测试账号具备业务写权限和触发器元数据可见性。本轮不证明生产最小权限方案。
- 生产构建显式传入 `VITE_SELF_SERVICE_UI_ENABLED=true`；未修改忽略的环境配置。最初默认构建关闭入口，只验证状态刷新，不能用于完整迁移验收。

## 已通过

1. 两次全新双实例运行真实来源准备脚本，覆盖 inspect、apply、幂等重跑、关闭能力、篡改材料拒绝、错误恢复目标拒绝。
2. 真实浏览器创建保险库、下载恢复材料、回填验证及保存。来源未登记时显示“历史数据来源待核验（11 条）”，不自动创建迁移任务。
3. 受控测试登记后手动刷新显示“可以迁移”，未填写账号密码/勾选影响确认前按钮仍不可用。
4. 从开始即使用 `TZ=UTC` 的全新环境，经用户确认、保护备份、独立恢复校验、真实 Worker 取源/加密/暂存/验证、finalize，页面自动显示“迁移完成，切换及审计已通过”。数据库任务 `completed`；11 条记录全部保留，旧 token_value 总字节数为 0。
5. 全新浏览器再次解锁，逐条查看 10 条可见密钥，与合成原值精确匹配；软删除记录不出现在列表。
6. `npm run build`（普通构建及显式开启入口构建）；`test-source-readiness.mjs`；`test-self-migration.mjs` 34 项；`test-status-retry.mjs`；Chrome `test-readiness-flow-browser.cjs`、`test-pr8-polling.cjs` 全部通过。构建仍有已有大 chunk 提示。

## 阻塞项 J1：非 UTC 进程将 UTC 数据解释为本地时间

严重度 P1，后端负责。定位：`shared/database/database.go:16` 使用 `parseTime=True&loc=Local`；迁移授权读取 `UTC_TIMESTAMP(6)`（例如 `modules/vault/self_service_auth.go:64`），`self_service_http.go` 的 selfGrant 用数据库时间生成 15 分钟授权。前端 `src/services/vault-self-service.ts:57` 对照真实 HTTP Date 校验到期时间。

复现：使用新建合成主库和独立恢复库，Go 进程按本机 Asia/Shanghai 运行，完成保险库/来源登记后点击一键迁移。创建接口 200，但客户端停止并提示校验失败。实际 2026-11-02 18:12:50+08:00 创建的任务，交付到期字段为 `2026-11-02T10:27:50.892547+08:00`，比当前时间早近 8 小时，任务详情显示 expired。预期是同一真实时刻之后约 15 分钟。

保护备份与独立恢复完成，但任务停在 client_processing，暂存 0/11。数据库复核 11 条源记录仍保留，旧值总字节数 209；没有切换或清除。仅重启为 UTC 并接续旧任务未能完成，不可视作对已有任务的修复；旧任务快照中时间字段的影响需要后端进一步检查。

对照：相同代码与合成材料，在全新数据库从开始以 UTC 运行，完整迁移成功。不能通过前端放宽授权有效期/密文验证绕过此问题。

建议后端统一数据库 UTC 时间的解析、写入和序列化，评估既有任务/租约/快照兼容；加入 Asia/Shanghai 与 UTC 进程的真实数据库回归，验证授权实际有效期、源交付、接续和最终切换。未修复前不宣布联合验收通过。

## 证据与范围

本机受限合成材料：非 UTC `/tmp/forge-source-example-p2nyywuz`，UTC `/tmp/forge-source-example-gg2zu_wl`。包含来源签名、审计计划、服务日志与 browser-result.json；非 UTC 首次失败另存 non-utc-browser-result.json。凭据和恢复材料不提交 Git。

本轮未重新执行全部旧版兼容、201 条跨分片、真实 429/40914 并发和用户备份下载后独立恢复的完整矩阵；429、身份变化和旧响应隔离采用注明的组件回归。保护备份的独立恢复与用户备份恢复不是同一个验收项。浏览器定位器的初次严格匹配/弹窗定位错误已修正，不列作产品缺陷。

临时服务与本轮四个合成 MySQL 容器在结束时清理，合成证据目录保留。现有 mysql、forge-vault-restore 服务不变。