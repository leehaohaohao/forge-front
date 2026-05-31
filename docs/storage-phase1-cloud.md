# 存储策略 — 第一阶段：对接云端

## Context

当前项目所有数据通过 axios 直接调后端 API，无登录态管理、无状态管理。本阶段目标：
- **统一 API 层**：提取公共 axios 实例，注入认证信息
- **认证体系**：登录/注册/JWT 管理
- **云端适配器**：标准化 CRUD 接口，页面不感知底层实现
- **Store 层**：用 Zustand 管理业务状态，替代页面内 useState

> 本阶段不涉及 IndexedDB 本地存储和同步引擎，所有数据均走云端 API。

## 架构总览

```
┌─────────────────────────────────────────┐
│           Page Components               │
│      (TokenPage, HomePage, ...)         │
├─────────────────────────────────────────┤
│        Zustand Store (状态层)            │
│     tokens / user / ...                 │
├─────────────────────────────────────────┤
│        Cloud Adapter (API)              │
│     /forge/* via Axios                  │
└─────────────────────────────────────────┘
```

## 模块设计

### 1. 公共 API 层 — `src/lib/api.ts`

提取公共 axios 实例，统一请求/响应处理：

- baseURL: `/forge`
- 请求拦截器：从 auth store 读 JWT，注入 `Authorization: Bearer <jwt>`
- 响应拦截器：401 → 自动 logout 并跳转登录页
- 响应拦截器：code !== 0 → message.error + reject

### 2. 认证层 — `src/stores/auth.ts` + `src/services/auth.ts`

**后端认证 API：**
- 注册：`POST /forge/auth/register` — { phone, password, username }
- 登录：`POST /forge/auth/login` — { phone, password } → { token, user: { id, username, status } }
- 认证方式：`Authorization: Bearer <jwt>`
- Token 有效期 72 小时，过期需重新登录
- 白名单路由（无需 token）：login、register，其他路由均需 token
- 错误码：0 成功 / 400 参数错误 / 401 未登录或过期 / 500 服务器错误

**auth store（zustand）：**
- `user`: { id, username, status } | null
- `token`: JWT string | null（持久化到 localStorage）
- `isLoggedIn`: computed（token 存在即为已登录）
- `login(phone, password)`: 调 POST /forge/auth/login → 存 JWT → 更新 store
- `register(phone, password, username)`: 调 POST /forge/auth/register
- `logout()`: 清 JWT → 清 store
- `initAuth()`: 启动时从 localStorage 读 JWT，检查是否过期（72h）

### 3. 存储适配器 — `src/lib/adapters/cloud-adapter.ts`

统一接口定义：

```ts
interface StorageAdapter<T> {
  list(params?: QueryParams): Promise<{ data: T[]; total: number }>;
  getById(id: string | number): Promise<T | null>;
  create(data: Partial<T>): Promise<T>;
  update(id: string | number, data: Partial<T>): Promise<T>;
  delete(id: string | number): Promise<void>;
}
```

**cloud-adapter.ts**（API 实现）：
- 所有 CRUD 操作走 axios
- 复用现有 `services/token.ts` 的接口调用模式
- 创建成功后返回云端 `id`

### 4. 存储路由 — `src/lib/storage.ts`

根据登录状态选择适配器：

```ts
function getTokenStorage(): StorageAdapter<Token> {
  // 本阶段始终返回云端适配器，未登录时拦截跳转登录页
  return cloudTokenAdapter;
}
```

### 5. Zustand Store — `src/stores/tokens.ts`

替代页面内 `useState`，管理密钥列表状态：

```ts
interface TokenStore {
  tokens: Token[];
  loading: boolean;
  pagination: { current: number; pageSize: number; total: number };

  fetchTokens(params?: QueryParams): Promise<void>;
  createToken(data: TokenFormValues): Promise<void>;
  updateToken(id: number, data: TokenFormValues): Promise<void>;
  deleteToken(id: number): Promise<void>;
}
```

## 登录页设计

- Ant Design Tabs 切换「登录」和「注册」
- 登录表单：手机号 + 密码 + 登录按钮
- 注册表单：手机号 + 用户名 + 密码 + 注册按钮
- 登录成功后存 JWT 到 localStorage + zustand store，跳转首页
- Header 右侧显示用户名 + 登出按钮（已登录时）
- 未登录时 Header 显示「登录」按钮

## 实施步骤

| 步骤 | 内容 | 涉及文件 |
|------|------|----------|
| 1 | 创建 `lib/api.ts` — 提取公共 axios 实例 + auth 拦截器 | 新建，改造 `services/token.ts` |
| 2 | 创建 `stores/auth.ts` — 认证 store | 新建 |
| 3 | 创建 `services/auth.ts` — login/register API 调用 | 新建 |
| 4 | 创建 `lib/adapters/cloud-adapter.ts` — API 适配器 | 新建 |
| 5 | 创建 `lib/storage.ts` — 存储路由 | 新建 |
| 6 | 创建 `stores/tokens.ts` — 密钥 store | 新建 |
| 7 | 改造 `services/token.ts` — 使用公共 api 实例 | 改造 |
| 8 | 改造 `pages/token/index.tsx` — 使用 zustand store | 改造 |
| 9 | 创建 `pages/login/index.tsx` — 登录/注册页 | 新建 |
| 10 | 改造 `App.tsx` — 添加登录路由 + auth 初始化 | 改造 |

## 新增目录结构

```
src/
  lib/
    api.ts              # 公共 axios 实例 + auth/响应拦截器
    storage.ts          # 存储路由（本阶段直接返回 cloud adapter）
    adapters/
      cloud-adapter.ts  # API 适配器
  stores/
    auth.ts             # 认证 store（zustand，JWT 持久化到 localStorage）
    tokens.ts           # 密钥 store（zustand）
  services/
    auth.ts             # 登录/注册 API
    token.ts            # 改为使用公共 api 实例
  pages/
    login/
      index.tsx         # 登录/注册页
```

## 验证方式

1. **登录流程**：输入手机号+密码 → 登录成功 → JWT 存入 localStorage → 跳转首页
2. **认证拦截**：未登录访问首页 → 跳转登录页
3. **Token 过期**：JWT 超过 72h → 请求返回 401 → 自动跳转登录页
4. **密钥 CRUD**：登录后 → 创建/编辑/删除密钥 → 数据通过云端 API 读写
5. **登出**：点击登出 → JWT 清除 → 跳转登录页
