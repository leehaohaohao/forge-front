# 自助迁移前1：入口及加密交付原型

2026-10-28。基于已合并前端2fd7edc，在codex/vault-self-service-front1实施。依赖后1 self-service-v1 API/JWE profile；本阶段不调用真实源交付或创建接口，不开启生产按钮，不单独提PR。

## 交付

- F1解析兼容新增self_service能力诊断，旧服务缺字段时保持关闭。迁移区域替换管理员申请、源文件输入为关闭的一键入口及实际阶段提示；保留原步骤布局和日常保险库功能。读取失败仍使用原重试状态，不伪造无历史记录。
- SelfServicePrototype为合成transport组件：本地解锁→Worker临时公钥→账号身份确认→一次范围/冻结确认→创建原型。生产不提供transport，即使旧VITE开关为true也不可执行。密码在身份请求开始清空输入，完成后清除引用；证明/授权仅在内存，取消/锁定/隐藏/卸载清理。同步busy锁防重复点击；未知创建结果禁止直接重复提交。
- 新delivery Worker使用Web Crypto RSA-3072/OAEP-SHA256、A256GCM。只导出投影公钥，私钥不可导出。严格canonical头、字段白名单、规范base64url、尺寸、用途、收件指纹、本人/任务/快照/epoch/chunk及有效期；AAD采用原始第一段。成功片段拒绝重复，失败停止接收。Worker仅返回公开信息、固定错误或字节数量，不返回源值。
- 原型使用独立Worker，生命周期随保险库锁定终止。后2/前2接入时再合入完整暂存/回执流程；此阶段未把字节级交付验证冒充完整记录集合或真实迁移验证。

## 验证

- npm run build：TypeScript/Vite通过，既有大包提示保留。
- node scripts/test-self-service-delivery.mjs：复用生产解密适配层生成公开夹具测试Worker；取消/重复启动意图测试通过。
- scripts/test-self-service-worker.cjs：Chrome真实Worker通过17项检查；Go与独立Web Crypto固定JWE逐字节匹配，错误私钥/接收指纹、用户/任务/快照/epoch、过期、重复片段及包装密钥/IV/密文/tag篡改、未知算法均拒绝。生成的私钥exportKey被拒绝。
- scripts/test-self-service-ui.cjs：开发StrictMode合成界面实际生成RSA公钥，身份确认、确认弹窗、双击、取消、单次创建、账号密码清空、公钥投影和无持久存储验证通过。

复现：启动生产preview 4180和开发Vite 3013；WSL先运行bundle生成脚本，再用已安装Playwright的Windows Node运行两个cjs测试。Worker固定向量测试使用临时blob测试脚本且测试上下文绕过CSP，仅用于注入公开测试私钥；生产CSP不修改，生产Worker使用同源构建文件。合成UI页面在tests目录，不纳入生产构建入口。公开向量来自后端modules/vault/testdata/self-service-jwe-v1.json，不含用户真实数据。

## 后续接入边界

后2实现真实准备与授权后再接transport；前2实现服务端时钟校准、任务/分片完整集合校验、受限网络桥接和跨片续跑。当前原型不调用source/stage/receipt/finalize、不校验自动保护备份、不宣称支持真实自助迁移。完整成功/异常任务轮询与最终完成页由前3接入。独立恢复、原M1核心与受限CLI保留，普通页面不再启动旧人工流程。
