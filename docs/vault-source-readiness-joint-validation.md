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
## 修复后复验（2026-11-02，后端 492453e）

结论：**授权立即过期已修复，但旧任务升级接续仍失败，暂不提 PR**。

真实进程仍使用 TZ=Asia/Shanghai。先在全新隔离双 MySQL 环境运行旧版 28bfec1 二进制，创建保险库、验证恢复材料、登记 11 条来源并复现旧版授权立即过期；随后仅替换为 492453e，保留全部保险库/任务/源记录。测试材料 `/tmp/forge-source-example-qydf11p3`。

- 新授权签发、任务读取、批次读取及 source-chunks 均返回 200，前端授权有效期校验通过。
- 使用原登录会话及重新签发的全新登录会话分别重认证接续，均在取源后报“输入或密文校验失败”；无 stage 请求，暂存仍为 0/11。
- 仅在合成环境通过现有 UI 取消旧任务并新建迁移。新任务真实加密/验证/finalize 成功；数据库 completed，11 条记录旧值总字节为 0。但页面等待 90 秒仍显示“正在完成迁移”和旧 0/11 进度。
- 正式构建（显式开启自助入口）、shared/database 定向测试及新版隔离来源准备脚本通过。

### R1：历史保护快照的删除时间与当前批次读取不一致

旧任务快照中软删除记录：`2026-11-02T12:24:12.343551+08:00`。
相同记录的 vault_migration_items.deleted_at 数据库值：`2026-11-02 12:24:12.343551`，修复后的 UTC 驱动返回 Z 时间。新任务快照为 `2026-11-02T12:24:12.343551Z`。

以上差异通过只读解密本轮合成保护备份和读取合成数据库确认，只输出时间字段，没有输出业务值或密钥。前端 self-migration.ts:35、37 严格比较清单/记录 deleted_at 与批次快照；旧快照因此不能通过绑定校验。换登录会话无法解决。不能直接放宽前端比较或批量加减历史日期，需后端设计安全的旧快照接续/失效恢复方案并覆盖软删除与其他时间元数据。

### R2：历史 created_at 偏移使旧任务长期占据 latest

同一账号两条真实测试任务：

| 状态 | 数据库 created_at |
| --- | --- |
| 旧 canceled | 2026-11-02 20:26:09.071759 |
| 新 completed | 2026-11-02 12:29:38.650381 |

GET /vault/self-service-migrations 返回 active=null、latest=旧 canceled；F1 却已返回最新批次 switched、encrypted=11、audit.complete=true。页面没有自动收敛到完成。应修复历史时间混合写入下 latest 与当前批次的关联/排序，并确保最终完成查询获取匹配任务；不能仅靠重新登录或等待 8 小时。

证据文件：old-failure.json（脚本成功复现旧故障，不表示迁移成功）、upgrade-resume-failed.json、browser-result.json（取消重建后页面未收敛）、logs/app.log 和合成保护备份。未操作真实业务库。现有服务保持不变，本轮临时服务和两个合成容器已清理。
## 第二次修复后复验（2026-11-02，后端 51b2e13）

结论：R2 已通过；R1 仍存在空历史时间字段边界，暂不提汇总 PR。前端代码未变，重新执行正式构建通过。

两套全新隔离双 MySQL 实例，进程始终 TZ=Asia/Shanghai。均先用旧版 28bfec1 创建保险库/验证恢复材料/登记来源/触发旧版授权失败，再仅升级服务至 51b2e13。

- R2（`/tmp/forge-source-example-f54nr4d0`）：UI 取消旧任务，再启动新任务；真实 Worker、保护备份/独立恢复、暂存/验证/切换/审计通过，页面自动显示“迁移完成，切换及审计已通过”。新浏览器再次解锁，10 条可见原值逐条核对通过，软删除记录隐藏。旧 canceled 的未来 created_at 未再阻止页面收敛。
- R1（`/tmp/forge-source-example-ub8ob36w`）：旧任务直接接续，session、任务详情、批次和 source-chunks 均 200，随后前端校验失败，无 stage。数据库仍 client_processing，11 条原记录完整，旧值总字节为 209。

剩余边界：本轮复用后端提供的 deployment example 合成数据，tokens.created_at/updated_at 为 NULL，进入 Go 模型后为零时间；软删除时间非空。旧保护快照中的 deleted_at 为 `2026-11-02T12:53:28.107969+08:00`，SQL 为 `2026-11-02 12:53:28.107969`。legacy_snapshot_time.go:29、38 直接采用零 CreatedAt 的 UTC Location，itemDeletedTime 返回 Z，仍与封存快照不同。修复未覆盖此场景。

历史 writer 的 Token 模型对 CreatedAt/UpdatedAt 使用 autoCreateTime/autoUpdateTime，没有 not null 声明。正常应用写入会填时间，但本轮不能据此认定所有历史/导入记录均非空。不能把零时间当作已知 UTC 来源；需根据可验证的原快照恢复表示，或在后端明确识别不支持的历史格式并给出可执行的安全恢复路径，而非接口成功后才在客户端失败。不要放宽前端绑定校验或凭偏移猜测原数据。

证据位于各目录 old-failure.json、browser-result.json、logs/app.log、保护备份和来源审计计划。old-failure 脚本的 passed 表示成功复现旧故障，不是迁移完成。两个后端来源准备集成样例及正式前端构建通过。临时服务与本轮四个合成 MySQL 容器已清理；没有修改真实业务数据。