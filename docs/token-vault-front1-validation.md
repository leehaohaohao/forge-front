# 方案 B 前1交付与验证

日期：2026-10-22（Asia/Shanghai）。开发位置：WSL Ubuntu-24.04 /home/lihao/projects/forge-front。
依据：../forge/docs/token-encryption-plan.md、token-api-contract.md 与 token-vault-format-v1.md 的 B1 契约。

状态：前1完成本地交付，可移交后2实现密文持久化/API；生产业务页面尚未切换。前2负责真实 API、重认证、剪贴板和页面生命周期集成。本记录不代表完成前4安全审查或生产发布。

## 实现

- src/lib/vault/format.ts：精确十进制字符串 ID（支持超过 2^53）、UUID v4、白名单字段、规范 Base64、Unicode 标量与 UTF-8、KDF 资源上限、固定顺序 AAD、尺寸/版本校验。
- src/lib/vault/crypto.ts：hash-wasm Argon2id + Web Crypto AES-256-GCM，128位标签/96位随机 nonce。生产密钥/DEK/RK/salt/nonce 只来自密码学随机源；替换生成新 DEK。新建与替换版本连续递增，每个 VK 的写入硬上限 1,000,000 次。密钥导入为不可导出 CryptoKey。固定 nonce 的底层 sealAt 仅用于公开向量，正式调用只使用随机 seal。
- src/lib/vault/worker.ts：初始化、密码解锁、恢复与改密码重包装、恢复材料重新输入验证、业务值加解密。VK/DEK/KEK 不出 Worker；RK 只在准备恢复材料时返回本地界面。凭据更新维持同一 VK，递增 credential_version，重新生成 salt/RK/两份包装；旧业务密文不变。未验证恢复材料不允许发布或写第一条业务秘密。
- src/lib/vault/session.ts：专用内存会话，不使用 Zustand/浏览器存储。锁定终止 Worker 并递增 generation，拒绝晚到响应；默认5分钟无操作、页面隐藏/pagehide/popstate 时锁定。publish 通过注入的 VaultTransport 工作，提交前读取身份/当前版本，响应不确定后读回比较同一份包装及 revision；断网重试保留同一草稿，不重新生成 VK。密码错误/包装损坏统一 UNLOCK_FAILED。
- src/dev/vault-prototype.tsx：独立本地原型，初始化→下载恢复文件→重新输入→本地解密验证→保存加密包装；还可密码解锁、恢复、修改密码、验证业务值往返和30秒隐藏。使用内存模拟传输，不访问真实业务接口，不加入正常应用路由。

初始化密码至少12 Unicode标量、至多1024 UTF-8字节，非全空白；既有包装解锁没有新密码最小强度规则。业务值1～8192 UTF-8字节，不裁剪或规范化。解锁密码与登录密码在界面明确分开。

可写的原始字节缓冲区在 finally 中覆盖；JS字符串、Web Crypto内部对象和WASM/引擎内存无法承诺即时物理擦除。锁定会销毁整个 Worker。界面恢复文件包含 RK，用户应离线保存并与密文备份分开；普通密文备份不含 RK。原型本身不会主动写入 localStorage/sessionStorage/IndexedDB。

## 固定依赖与来源

- hash-wasm **4.12.0**（MIT），package.json 无 ^，package-lock.json 固定完整性。
- Argon2id v19：65536 KiB、3次、4 lanes、16字节 salt、32字节输出；仅接受此一组参数，不降级。
- 发布完整性：sha512-+/2B2rYLb48I/evdOIhP+K/DD2ca2fgBjp6O+GBEnCDk2e4rpeXIK8GvIyRPjTezgmWn9gmKwkQjjx6BtqDHVQ==。
- 维护者版本源码：https://github.com/Daninet/hash-wasm/tree/v4.12.0 。已核对调用映射、包内 lib/argon2.ts 和发布完整性；WASM 在包中内嵌，本地 Vite Worker 打包，不从 CDN 加载。此核对不是第三方密码学审计。
- 测试依赖 playwright **1.62.1**，仅 devDependency。测试脚本使用 Vite 已依赖的 esbuild 转换正式模块进行 Node 向量验证。
- npm audit 当前共14项（1 low、5 moderate、8 high），hash-wasm/playwright/playwright-core 均未出现在漏洞条目中。其余既有依赖不在本次擅自升级；完整应用依赖审查仍需在前4关闭。

公开向量逐字节复制自后1的 testdata；原始位置为 ../forge/docs/testdata/token-vault-v1-vectors.json，前端位置 tests/vault/token-vault-v1-vectors.json。
SHA-256：d1f7eb50c693486f35fac78fd487e774ef064e91e11acc6fc3211168d896f13e
测试同时读取后1 API fixtures，生产入口不导入向量或测试秘密。

## 已执行验证

- npm run test:vault：通过；复现 Go Argon2id 和 Go/Python AES-GCM 的全部9组 AAD、密文与包装字节，覆盖Unicode原样编码/NFC区别、替换、VK轮换只重包装DEK。
- npm run build：通过；现有大包警告仍存在。正常业务入口未被原型替换。
- npm run build:vault：通过；独立 .vault-dist 产物（已 gitignore），Worker约36.8kB，含本地WASM。
- Chromium 151.0.7922.34、Microsoft Edge 155.0.4283.62：通过正式模块向量、真实Worker、恢复/重试和已打包原型交互。最后一次单次KDF为229/328ms，Worker解锁含启动为280/228ms（单机样本，非所有设备性能保证）。内置Chromium155也通过初版向量/Worker验证。
- 错误密码/RK、损坏包装、标签/nonce/AAD/domain/user/secret/version篡改均拒绝；超限KDF、未知字段/版本、非规范Base64、未配对代理项、过长业务值和写入上限均拒绝。
- 恢复材料未保存/未重新输入或错误重新输入时禁止发布；密码改动/恢复后新凭据解同一VK与原业务密文，RK已更新。
- 初始化已写入但响应丢失时只读回确认同一份包装；真正断网后重试沿用原草稿；远端已有不同保险库时不覆盖；锁定后晚到read不会继续上传。
- 独立新会话默认锁定；KDF未返回即锁定不会重新解锁；自动闲置锁定通过缩短测试时钟验证，默认实现仍为5分钟。
- 原型恢复文件实际下载、重新输入验证、元数据与恢复输入清理通过；测试期间未发现远程资源、任何POST/业务秘密上传，localStorage/sessionStorage为空。

机器可读结果见 [token-vault-front1-browser-report.json](token-vault-front1-browser-report.json)。
浏览器测试为独立无头上下文，Chromium此模式下所有tab一直可见，因此 visibilitychange 路径以受控document.hidden信号验证，并非已验证系统原生切换tab。原生标签页隐藏、移动设备、Firefox/Safari、剪贴板与完整SPA/退出/401链路仍归后续集成验收，不能据此承诺所有浏览器受支持。

## 本地运行

WSL项目目录中执行：
```sh
npm run dev
npm run test:vault
npm run build:vault
npm run preview:vault
```
开发原型：http://localhost:3000/vault-prototype.html 。向量/Worker测试页面：http://localhost:3000/vault-tests.html 。独立打包预览：http://localhost:4177/vault-prototype.html 。两个入口只作前1实验，不部署到生产业务目录。

Node浏览器脚本：保持dev服务运行，若验证打包原型再启动preview，执行：
```sh
VAULT_PROTOTYPE_URL=http://localhost:4177/vault-prototype.html npm run test:vault:browsers
```
默认验证chromium与msedge，浏览器必须安装在运行Node的系统里。可用 VAULT_BROWSERS=chromium 选择已有目标；在WSL执行时需要Linux浏览器，Windows现有浏览器请用Windows Node执行本脚本，不能把Windows浏览器路径传给Linux Playwright。报告输出目录通过 VAULT_TEST_ARTIFACTS 指定，默认不落截图/报告文件。测试仅使用虚构材料。

## WebStorm启动错误的处理

报错原因：WSL项目使用Windows npm.exe，CMD不能用UNC目录作为工作目录。业务package.json无需改成Windows绕过命令。
WebStorm设置 → Languages & Frameworks → JavaScript Runtime（部分版本为Node.js），添加/选择WSL解释器：
- 发行版 Ubuntu-24.04。
- Node `/home/lihao/.local/bin/node`。
- npm `/home/lihao/.local/bin/npm`。
现有dev/build配置使用project解释器，切换项目解释器后沿用。运行中的IDE解释器设置未由本次任务直接改写。

Windows终端可立即运行仓库 scripts/dev-wsl.cmd，它固定WSL目录和PATH；等效命令：
```powershell
wsl.exe -d Ubuntu-24.04 --cd /home/lihao/projects/forge-front -- env PATH=/home/lihao/.local/bin:/usr/local/bin:/usr/bin:/bin /home/lihao/.local/bin/npm run dev
```
已实测Vite启动于3000端口。D盘副本已恢复，后续开发继续在WSL。

## 移交后2/前2

字节协议与KDF参数无需变更，支持后2据B1契约实现密文端点。现有业务token页面、store、service尚维持旧流程，必须由前2与后2联合替换，禁止把本原型当作完整业务切换上线。
前2应注入真实VaultTransport，凭据更新独立执行账号重认证并携带X-Forge-Reauth；普通业务write只上传secret_envelope。仅从GET /vault取得精确user_id；access校验记录id/revision/归属后再构造可信上下文。替换调用encrypt时明确传入先前secret_version，不能下降或跳号；wrapCount取服务器当前计数，服务端也必须原子限额。
路由离开/unmount、登出/401必须调用lock/dispose，调用方在网络/剪贴板等副作用前检查epoch/isCurrent；本模块不操作或清空系统剪贴板。初始化/凭据更新的重试必须保留草稿并先读回，不允许新建VK覆盖。
