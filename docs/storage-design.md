# 存储策略设计方案

## Context

当前项目所有数据通过 axios 直接调后端 API，无本地存储、无登录态、无状态管理。需要重新设计存储层，支持：
- **未登录**：数据存 IndexedDB（本地）
- **已登录**：数据同时存本地 + 云端（后端 API），实时双向同步
- 此策略适用于密钥管理及后续所有业务模块

## 架构总览

```
┌─────────────────────────────────────────────────────┐
│                    Page Components                    │
│              (TokenPage, HomePage, ...)               │
├─────────────────────────────────────────────────────┤
│                 Zustand Store (状态层)                 │
│         tokens / user / sync / ...                    │
├──────────────────────┬──────────────────────────────┤
│    Local Adapter     │     Cloud Adapter             │
│    (IndexedDB)       │     (Axios API)               │
│    via Dexie         │     /forge/*                  │
├──────────────────────┴──────────────────────────────┤
│               Sync Engine (同步引擎)                   │
│    写入时双写 / 登录时推同步 / 冲突检测                   │
└─────────────────────────────────────────────────────┘
```

## 模块设计

### 1. 本地数据库 — `src/lib/db.ts`

使用 **Dexie**（IndexedDB 封装库）定义本地数据库。

```ts
// 数据库名: forge-db
// 表: tokens, (后续扩展: navLinks, settings, ...)
```

每条本地记录附加元数据：
- `_localId`: 本地唯一 ID（UUID，离线创建时使用）
- `_synced`: boolean，是否已同步到云端
- `_updatedAt`: 本地最后修改时间戳
- `_deleted`: boolean，软删除标记（同步后清理）

**Token 表结构：**
```
tokens: _localId, id(云端ID), provider, name, token_value, 
        token_type, category, mask_prefix_len, mask_suffix_len,
        expires_at, remark, user_id, created_at, updated_at,
        _synced, _updatedAt, _deleted
```

### 2. 认证层 — `src/stores/auth.ts` + `src/lib/api.ts`

**后端认证 API（已对接文档）：**
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
- `login(phone, password)`: 调 POST /forge/auth/login → 存 JWT 到 localStorage → 更新 store
- `register(phone, password, username)`: 调 POST /forge/auth/register
- `logout()`: 清 JWT → 清 store → 切到未登录模式
- `initAuth()`: 启动时从 localStorage 读 JWT，检查是否过期（72h）

**api.ts 改造：**
- 提取公共 axios 实例到 `src/lib/api.ts`，baseURL: `/forge`
- 请求拦截器：从 auth store 读 token，注入 `Authorization: Bearer <jwt>`
- 响应拦截器：401 → 自动 logout 并跳转登录页
- 响应拦截器：code !== 0 → message.error + reject（保留现有逻辑）

### 3. 存储适配器 — `src/lib/adapters/`

统一接口，页面不感知数据来源：

```ts
interface StorageAdapter<T> {
  list(params?: QueryParams): Promise<{ data: T[]; total: number }>;
  getById(id: string | number): Promise<T | null>;
  create(data: Partial<T>): Promise<T>;
  update(id: string | number, data: Partial<T>): Promise<T>;
  delete(id: string | number): Promise<void>;
}
```

**`local-adapter.ts`**（IndexedDB 实现）：
- 所有 CRUD 操作走 Dexie
- 创建时生成 `_localId`（UUID），`_synced: false`
- 更新时更新 `_updatedAt`，`_synced: false`
- 删除时标记 `_deleted: true`，不物理删除（等同步后清理）

**`cloud-adapter.ts`**（API 实现）：
- 所有 CRUD 操作走 axios
- 复用现有 `services/token.ts` 的接口调用模式
- 创建成功后返回云端 `id`

### 4. 存储路由 — `src/lib/storage.ts`

根据登录状态选择适配器：

```ts
function getTokenStorage(): StorageAdapter<Token> {
  if (authStore.getState().isLoggedIn) {
    return cloudTokenAdapter;  // 已登录走云端
  }
  return localTokenAdapter;    // 未登录走本地
}
```

页面统一调用 `getTokenStorage().list()` 等方法，不关心底层是本地还是云端。

### 5. 同步引擎 — `src/lib/sync.ts`

**触发时机：**
- 登录成功后 → 推同步（本地 → 云端）
- 登录状态下每次本地写入 → 双写（本地 + 云端）
- 定时拉取（可选，轮询或 WebSocket）

**同步策略：**
1. **登录时推同步**：扫描本地 `_synced === false` 的记录，逐条调云端 create/update，成功后标记 `_synced: true`
2. **已登录状态下的写入**：同时写本地和云端，云端失败不影响本地写入（标记 `_synced: false` 等待重试）
3. **冲突检测**：基于 `updated_at` 时间戳，云端更新则拉取覆盖本地；本地更新则推送覆盖云端（last-write-wins）
4. **删除同步**：本地软删除 `_deleted: true` → 同步时调云端 delete → 成功后物理删除本地记录

### 6. Zustand Store — `src/stores/tokens.ts`

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

内部调用 `getTokenStorage()` 获取适配器执行操作。已登录时，写入成功后触发同步。

## 新增目录结构

```
src/
  lib/
    api.ts              # 公共 axios 实例 + auth/响应拦截器
    db.ts               # Dexie 数据库定义
    storage.ts          # 存储路由（根据登录态选适配器）
    sync.ts             # 同步引擎
    uuid.ts             # UUID 生成工具
    adapters/
      local-adapter.ts  # IndexedDB 适配器
      cloud-adapter.ts  # API 适配器
  stores/
    auth.ts             # 认证 store（zustand，JWT 持久化到 localStorage）
    tokens.ts           # 密钥 store（zustand）
  services/
    auth.ts             # 登录/注册 API（POST /forge/auth/login|register）
    token.ts            # 改为使用公共 api 实例
  pages/
    login/
      index.tsx          # 登录/注册页（手机号+密码，Tab 切换登录/注册）
```

## 登录页设计

- Ant Design Tabs 切换「登录」和「注册」
- 登录表单：手机号 + 密码 + 登录按钮
- 注册表单：手机号 + 用户名 + 密码 + 注册按钮
- 登录成功后存 JWT 到 localStorage + zustand store，跳转首页
- Header 右侧显示用户名 + 登出按钮（已登录时）
- 未登录时 Header 显示「登录」按钮

## 实施步骤（建议顺序）

| 步骤 | 内容 | 涉及文件 |
|------|------|----------|
| 1 | 安装依赖：`dexie` | package.json |
| 2 | 创建 `lib/db.ts` — Dexie 数据库定义 | 新建 |
| 3 | 创建 `lib/api.ts` — 提取公共 axios 实例 + auth 拦截器 | 新建，改造 `services/token.ts` |
| 4 | 创建 `lib/uuid.ts` — UUID 工具 | 新建 |
| 5 | 创建 `lib/adapters/local-adapter.ts` — IndexedDB 适配器 | 新建 |
| 6 | 创建 `lib/adapters/cloud-adapter.ts` — API 适配器 | 新建 |
| 7 | 创建 `lib/storage.ts` — 存储路由 | 新建 |
| 8 | 创建 `stores/auth.ts` — 认证 store | 新建 |
| 9 | 创建 `stores/tokens.ts` — 密钥 store | 新建 |
| 10 | 改造 `services/token.ts` — 使用公共 api 实例 | 改造 |
| 11 | 改造 `pages/token/index.tsx` — 使用 zustand store | 改造 |
| 12 | 创建 `services/auth.ts` — login/register API 调用 | 新建 |
| 13 | 创建 `pages/login/index.tsx` — 登录/注册页（手机号+密码表单） | 新建 |
| 14 | 改造 `App.tsx` — 添加登录路由 + auth 初始化 | 改造 |
| 15 | 创建 `lib/sync.ts` — 同步引擎 | 新建 |
| 16 | 登录后触发同步，Header 显示用户状态 | 改造 |

## 后续扩展适用

此策略适用于后续所有业务模块，只需：
1. 在 `db.ts` 添加表定义
2. 创建对应的 `adapters/xxx-adapter.ts`
3. 创建 `stores/xxx.ts`
4. 页面通过 `getXxxStorage()` 调用

## 验证方式

1. **未登录模式**：清除 JWT → 创建密钥 → 刷新页面 → 数据仍在（IndexedDB）
2. **登录同步**：登录 → 本地未同步数据自动推到云端 → 云端数据拉到本地
3. **双写验证**：已登录状态创建密钥 → 本地和云端都有记录
4. **离线容断**：断网状态下创建密钥 → 恢复网络后自动同步
5. **登出隔离**：登出后只看到本地数据，云端数据不可见
