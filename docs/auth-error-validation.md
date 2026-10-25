# 登录错误与鉴权失效修复验收

日期：2026-10-25

## 行为

- 请求拦截器不弹提示，只抛出统一 ApiError；登录、注册通过现有 Ant Design App.useApp() 实例显示一次提示。未调整提示位置。
- ApiError 保留 httpStatus、businessCode、requestId，标识优先取 X-Request-ID，再取响应 request_id。错误对象不携带原始响应正文、请求密码或 Authorization。
- 安全文案按类别固定映射。旧认证接口共用 code 400，因此仅在对应登录/注册路径识别“手机号或密码错误”“账号已被禁用”“该手机号已注册！”三个已确认的精确消息；其他 400/422 显示参数错误，HTTP 或旧业务 5xx 显示服务不可用，断网显示网络错误，不直接展示任意后端异常。
- HTTP 401 或 HTTP 200/code 401 统一清理本地登录信息并发出鉴权失效事件；auth store 同步清空内存登录态与令牌列表，保险库终止会话，路由守卫返回登录页。
- code 40101 优先视为账号重认证失败，不退出登录、不清理保险库待确认状态，允许重新输入账号密码继续。
- 保险库冲突、迁移限制、取消等提示兼容新错误类型。

## 验证

- `node scripts/test-api-errors.mjs`：HTTP/业务错误元数据、安全白名单、HTTP 401 与旧 code 401 的本地及内存清理、保险库 epoch 失效、两种 40101 不退出、网络与取消错误。
- `npm run build`：类型检查与生产构建通过，仍有原有大体积 bundle 提示。
- `scripts/test-auth-errors.cjs`：Chromium 生产页面验证登录及注册的账号/参数/服务/网络错误，每次请求仅一个提示、一个 App 提示容器；原始异常哨兵未进入页面。
- `scripts/test-vault-page.cjs`：Chromium 分别以 VAULT_AUTH_EXPIRY=legacy/http 完成全流程回归，覆盖 200/code 401 和 HTTP 401 跳转及存储清理；200/code 40101 和 HTTP 401/code 40101 都保留登录与待确认草稿，并能成功重试保存。

浏览器使用 fixture 接口及测试凭据，不涉及业务数据；未部署生产。
