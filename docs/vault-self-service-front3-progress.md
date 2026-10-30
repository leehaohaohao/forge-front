# 自助迁移前3进度（尚未完成联合验收）

2026-10-29，后端基线07de92a。

已接入自助操作区：身份确认、显式全量/替换租约确认、新建/接续、准备轮询、Worker处理、自动finalize、实际任务轮询、失败重试及取消专用授权。主流程仅在switched和审计完成且写入闸门解除时确认完成，不再要求旧F2人工任务回执。完成后刷新列表使用的状态键，备份与独立恢复区分展示。

新入口受前端VITE_SELF_SERVICE_UI_ENABLED=true与后端实际能力共同控制。默认保持关闭。该变量位于前端.env.dev/.env.pro，改动需重启开发服务或重新构建；本次没有修改环境配置。后端配置按后3部署文档，不能用前端变量代替。旧CLI仅用于受限故障处理，正常流程不需要源文件或管理员切换。

已通过正式构建及34项前2处理核心回归。尚未完成：新增操作区浏览器交互验收、普通用户真实页面→真实HTTP→隔离MySQL/恢复库全链路，以及取消竞争/旧任务接续的页面验证。本记录不是前3完成验收；禁止据此开放生产入口或宣称真实迁移闭环通过。

## PR #8 审阅修复（2026-10-30）

完成查询按实际 vault/batch 匹配自助任务；新接口40910或没有匹配任务时查询旧F2。匹配的新任务即使失败也保持权威，不用旧完成回执覆盖。网络/鉴权等非40910错误不吞掉。

显式退出捕获原Bearer发起POST /vault/self-service-session/revoke，并立即锁定及清理本地。独立fetch设置5秒超时、no-store及keepalive，迟到响应不经过全局401拦截器，不影响新登录；网络失败仍完成本地退出，不能保证离线时服务端撤销成功。普通锁定不撤销，鉴权失效事件只清本地，避免递归撤销。

新增 scripts/test-pr8-review.mjs：完成查询40910/无任务/其他批次兼容，新任务权威及错误传播；真实认证store（隔离Worker边界）立即清理、原Bearer、网络失败、迟到401与新登录、失效事件和成功响应。构建、新测试和34项核心回归通过。未将这些定向合成测试声称为真实页面/后端/隔离库联合验收。后端blockers=null契约问题及完整联合验收仍需配套完成。

## PR #8 第二轮：终态刷新与轮询预算

仅在同一任务从已观察的非终态转入终态时刷新父级；首次读到历史canceled/completed不刷新，卸载重挂不会循环。已取消任务显示“一键迁移”，重新创建时使用resumeExisting而非续接已取消会话。

后台列表查询在本地操作busy期间暂停；准备阶段仅保留详情查询，每15秒一次，为共享12次/分钟预算预留余量。准备读取遇到429按Retry-After等待，保留client和授权上下文，不自动要求再次输入密码。等待监听在结束后移除。

验证：npm run build、test-pr8-review.mjs、34项test-self-migration.mjs通过。新增test-pr8-polling.cjs在Chrome运行真实SelfServiceMigration与模拟父组件卸载重挂，使用浏览器虚拟时钟覆盖历史取消任务60秒稳定停留、准备90秒含429仍运行且无列表并发、终态刷新后重挂稳定及再次开始。HTTP与SelfMigrationClient操作使用合成替身，保险库本地初始化为真实Worker；不是实际VaultPanel全链路或真实后端联合验收。

## PR #8 第三轮：初次空任务

阶段比较先检查previous与当前任务均存在，再核对task_id和phase；空列表及首次快照不会访问空对象或触发终态刷新。独立pollError在成功读取后清除，操作错误仍单独保留，避免后台成功响应掩盖用户操作失败。

扩展Chrome页面测试：active/latest均null，连续空列表轮询，空列表后出现新任务均无错误提示和额外刷新；模拟查询网络失败出现提示，恢复成功后清除。原取消历史、重挂、再次开始、90秒准备及429保留上下文场景仍通过。正式构建、test-pr8-review及34项核心回归通过。浏览器测试继续使用合成HTTP和client替身，不宣称完成真实后端联合验收。

## PR #9：仅身份变化取消状态重试

storage监听限定localStorage，且key为forge_token或clear事件（key=null）；读取当前token并与已观察值比较，无实际变化时不取消。无关工作区、sessionStorage不影响Retry-After等待。实际身份变化和认证失效显式清除旧视图/结束loading，取消控制器和计时器，不再保留自动继续承诺。

验证：test-status-storage-browser.cjs在同一Chrome context的两个页面通过真实storage事件覆盖工作区变更、token替换/删除、localStorage.clear；额外验证sessionStorage事件忽略，以及旧完成响应在token变化后才返回也不得回写。等待120秒虚拟时间后无关变化自动完成，身份变化保持终止。测试使用真实useVaultFlow、模拟HTTP适配器；非真实限流联合验收。正式构建、test-status-retry.mjs、test-pr8-review.mjs通过。
