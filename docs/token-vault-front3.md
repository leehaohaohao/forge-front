# 前3本地迁移与恢复工具

2026-10-23。在 WSL 前端仓库运行，复用前1密码学模块。此工具使用独立 Node 进程，不向网页或浏览器持久存储加载历史明文；退出即释放会话。依赖已初始化的保险库，先在密钥页面完成初始化及恢复材料验证。

## 使用

需要 Node 24 和已安装的项目依赖。在项目目录执行：

```sh
npm run vault:local -- migrate /private/source.jsonl https://your-forge-host
npm run vault:local -- export /private/backup.json https://your-forge-host
npm run vault:local -- verify-backup /private/backup.json /private/backup.json.sha256
npm run vault:local -- verify-shards /private/backup-directory
```

凭据由终端隐藏输入，不放命令行参数或文件。迁移每个新 stage/receipt 都单独要求账号重认证；服务端限流时退出，稍后重跑。恢复密钥验证模式在命令最后追加 `recovery`（verify-shards 为目录后追加）。不要使用录制终端或开启调试采集。

源文件来自后3受控运维导出，不存在业务明文下载接口。工具检查归属、集合、版本、删除状态，上传仅包含密文包；读取暂存实际包后解密逐字节比较，再发送规范摘要回执。响应丢失只重试同一请求ID与包；再次运行先读回状态，不重新加密已暂存项。分页版本变化、冲突、错误凭据、损坏文件立即失败，不跳项。

加密导出保存原始JSON字节及SHA-256旁文件，权限0600且不覆盖已有文件。分片验证检查规范文件名、逐片原始摘要、字节数、行数、总数和归属，逐包本地解密验证；legacy_pending只报告不完整，不能声称恢复成功。验证工具不打印任何明文，不向服务器上传恢复密钥，也不写回业务记录。

验证：`node scripts/test-vault-migration.mjs` 覆盖M1摘要夹具、非法输入、加密暂存、响应丢失、重复运行、回执绑定与篡改拒绝；另复跑 `npm run test:vault`。实际业务库迁移、独立设备人工恢复演练尚未执行，后4才实施有效记录切换与源清空。本阶段不提PR。
