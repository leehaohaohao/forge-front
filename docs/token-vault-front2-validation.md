# 方案 B 前2：业务页面接入

2026-10-23，WSL `/home/lihao/projects/forge-front`。按后2冻结契约完成前端本地交付。本阶段仅提交 Git，整个功能完成后才提 PR；未部署或迁移业务数据库。

## 已交付

- token 类型、service、store、页面使用字符串 ID/revision；AAD 身份来自 GET vault，测试覆盖超过 JS 安全整数的 ID。
- 退出通用 cloud-adapter 的 token 调用链，并禁止用该适配器访问 token/vault。专用服务显式投影元数据，写请求不展开 UI 明文输入。
- 初始化需要下载并重新输入验证恢复材料；不确定提交读回确认同一个草稿。解锁、修改解锁密码、恢复由本地 Worker 完成；凭据更新需独立账号重认证。
- 新增、替换先本地加密；空编辑输入保留旧包，保留 expires_at 省略/null/日期语义。元数据编辑不 access、不解密。历史记录只可编辑元数据、删除。
- 查看/复制核对记录 ID、用户、revision、vault/key version 和已知 secret_id，再用当前上下文校验 AAD；本会话首次访问的 secret_id 依赖认证服务端绑定，未声称解决恶意服务端整套回放。
- 替换保留 secret_id，secret_version +1；每次秘密写入前获取 vault revision；409刷新列表并保留冲突提示，不自动重试覆盖。
- 固定遮罩；查看30秒隐藏；5分钟无操作、隐藏页面、离开路由、刷新、退出、登录失效、跨标签认证改变时锁定。取消请求并检查 generation，晚到结果不能显示、继续复制或发起写入。
- 剪贴板成功才提示；拒绝时将明文仅短暂保存在组件引用中，并提供再次点击确认，30秒或锁定清除。已经提交给操作系统的剪贴板写入无法撤销；锁定不清除用户剪贴板。
- 新建、关闭、成功保存、锁定和路由离开清理表单；无秘密日志、URL、浏览器持久化或会话录屏 SDK。账号重认证密码是契约允许的唯一独立密码上传，保险库密码/RK从不上传。

## 安全与同源内容

生产 build 注入 CSP：脚本只允许 self 和 wasm-unsafe-eval；禁止 inline JS、eval、第三方脚本、object、base URI；Worker 只允许 self，连接只允许 self。Ant Design 需要 inline style；图片仍允许 HTTPS。开发 HMR 环境不使用生产策略。
移除入口内联脚本，知识 Markdown 查看及编辑预览均 skipHtml；不增加危险 HTML 注入或远程密码学代码。直接依赖固定为当前 lockfile 已解析版本，未升级依赖。
参考：[MDN script-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src)。

CSP 是纵深防御，不能保证抵御同源依赖漏洞、恶意扩展或被篡改的应用代码。知识内容和保险库仍同源，需要前4独立审查；未来加入录屏/遥测必须排除敏感页与请求正文。正式服务器应补充 CSP frame-ancestors 响应头和 HTTPS，meta CSP 不支持 frame-ancestors。生产应发布完整配套构建，避免继续投放旧入口；不能单独上线旧前端和新 API。

## 验证结果

- `npm run build` 通过：TypeScript + 生产 Vite bundle（包含本地 Worker/WASM）。已有主 bundle 大小警告仍存在。
- `npm run test:vault` 通过：9组 Go/Python 字节向量、Unicode、篡改/错误密码、格式/KDF上限、随机替换、VK轮换和凭据重包装。
- `npm run test:vault:page`：Chromium 151.0.7922.34、Microsoft Edge 155.0.4283.62 均通过。
- 浏览器加载正式生产 bundle（含 CSP），使用真实 Web Crypto、WASM 与 Worker；接口由隔离的契约夹具提供，没有访问业务服务器。
- 覆盖：初始化下载/验证、精确 ID、新增、保留原始空格及多字节值、元数据-only不access、替换版本、复制成功/拒绝重试、错记录拒绝、409不覆盖、锁后晚到响应、表单清理、错误密码、30秒/5分钟定时、RK恢复+账号重认证+同VK原记录解密、legacy限制、版本删除、路由/刷新/401、网络与 storage 无秘密。
- 定时器用浏览器虚拟时钟加速；页面隐藏用受控 visibilitychange；剪贴板权限分支用可控 Clipboard API 实现验证。原生切换标签/OS剪贴板权限和全链路真实后端+数据库联调仍应在前4验收，不冒充已完成。
- `git diff --check` 通过；src 中无 token_value、真实前后缀预览或明文 token 适配器调用。

复现：先 `npm run build`，再 `npm exec vite -- preview --mode pro --port 4180 --strictPort`，另一终端运行 `npm run test:vault:page`。需安装 Playwright Chromium 与系统 Edge；可通过 VAULT_PAGE_URL / VAULT_BROWSERS 指定本地预览地址和浏览器。测试只用虚构材料，不保存截图/日志中的真实秘密。

## 移交

后3/前3继续处理历史清点、本地迁移和完整加密备份；本次恢复材料文件是 RK，不是全部记录的加密备份。业务库尚未切换，不能宣称历史数据已无明文。前4继续配套后端、真实权限、同源 XSS 与上线安全验收。
