# 自动迁移精简方案：前2兼容层退役

日期：2026-11-04。分支 codex/vault-front2-retirement，基于前1及联合验收提交 87e0125。
后端契约依据 8723e16 和 docs/vault-backend3-retirement.md。前2实现与定向回归通过。

## 改动

- 删除 AutoMigration 挂载、调度、service、临时 JWE 转换协议，以及 Worker 的临时 RSA 密钥和迁移 RPC。
- 删除此前已卸载的四步向导、readiness、任务/批次、来源文件、self-service 页面及服务、旧专用交付 Worker、旧退出撤销接口和对应专用测试夹具。
- 日常 Worker 仅保留创建、解锁、恢复材料验证、凭据包装、加解密。日常锁定、隐藏/空闲清理、迟到请求保护不变。
- 日常 token DTO 只接受 client_encrypted；未知或退役状态报校验失败，不假装“已加密”，不再展示“待迁移”入口。
- 从旧 migration-core 抽出 backup-core 和本地导出使用的 rate-limit；恢复 Worker 直接使用 strict-json。CLI 保留 export、verify-backup、verify-shards，删除 migrate 命令。
- B1 历史备份的 legacy_pending_count 仍可读取：不完整旧备份继续明确返回 complete=false。这是离线备份格式兼容，不恢复任何迁移接口。
- 删除示例环境文件中的迁移开关；未修改忽略的本机配置。历史验收文档保留为历史记录。
- 回归发现编辑弹窗卸载后丢失供应商预填值，以及重新编辑时可能回填上次名称。改为挂载时使用当前记录 initialValues，Form clearOnDestroy 清理旧状态，避免在卸载状态预填。关闭/锁定仍清理密钥输入。

## 验证

- npm run build：通过。存在原有大 chunk 提示和外部 outDir 提示，没有清理共享构建目录。
- node scripts/test-vault.mjs：固定向量、KDF/AAD/包装、Unicode、篡改、版本与凭据重包装通过。
- node scripts/test-api-errors.mjs：错误元数据、安全提示、HTTP/旧业务401、40101区别通过。
- node scripts/test-vault-retirement.mjs：源码中无退役协议调用；独立 B1 解密、归属、重复 secret ID、损坏包、历史不完整备份、严格 JSON 校验通过；日常 DTO 拒绝 legacy_pending/未知状态。
- scripts/test-vault-page.cjs：Chrome 147.0.7727.56，真实 React/Worker/WebCrypto，HTTP 使用合成接口。开发服务及最终正式构建预览通过。
  覆盖新用户创建/下载/验证恢复材料、精确大 ID、密文新增/查看/复制、编辑元数据、替换秘密、删除、拒绝篡改和冲突、锁定取消迟到响应、隐藏/空闲锁定、恢复材料改密码、40101、登录失效清理。
  本轮增加实际加密备份下载及干净浏览器恢复 Worker 验证；断言整个操作、离页和刷新期间没有迁移/self-service/readiness API 请求。
- scripts/test-vault-retired-tab.cjs：使用本机保留的前1正式资源 index-ft-HONrK.js 加载旧页面，模拟退役后404。旧页面解锁后停止迁移、日常新增仍可用；刷新替换为前2正式资源后锁定，重新解锁无退役请求。
  该用例需要保留上一版本资源及其 Worker 依赖，通过 VAULT_PREVIOUS_BUNDLE 指定；不把旧构建资源提交仓库。
- git diff --check：通过。

复现浏览器回归：正式构建后 npm run preview -- --mode pro --host 0.0.0.0 --port 4180 --strictPort，
设置 VAULT_PAGE_URL=http://localhost:4180、VAULT_BROWSERS=chrome，运行 scripts/test-vault-page.cjs。
旧标签页用例另设置 VAULT_PREVIOUS_BUNDLE=index-<上一版本哈希>.js，
运行 scripts/test-vault-retired-tab.cjs；预览目录需包含指定旧产物。

## 边界

本轮是前2实现及前端定向验收；未执行真实业务库014、未删除业务数据、未部署。
旧标签页用例的404是明确模拟的后3契约，不能替代实际后端和最终 schema 的联合退役验收。
后续在014维护窗口及后3部署完成后，仍需使用最终新装/升级数据库复核日常操作与旧页面恢复。
本次阶段提交包含前1之后的清理，不自动合并分支。