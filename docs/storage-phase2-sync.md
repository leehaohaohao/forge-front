# 存储策略 — 第二阶段：本地存储 + 双向同步

## 前置条件

第一阶段（对接云端）已完成，具备：
- 公共 API 层 + 认证拦截器
- 认证 store + 登录/注册页
- 云端适配器 + 存储路由
- Zustand store 层

## Context

第一阶段所有数据均走云端 API，存在以下问题：
- **未登录无法使用**：没有账号就无法存储任何数据
- **离线不可用**：断网后无法创建/查看密钥
- **网络延迟**：每次操作都要等 API 响应

本阶段目标：
- **本地存储**：未登录时数据存 IndexedDB，离线可用
- **登录时同步**：登录后本地未同步数据推到云端，云端数据拉到本地
- **已登录双写**：每次写入同时更新本地和云端
- **冲突处理**：last-write-wins 策略

## 架构总览

```
┌─────────────────────────────────────────────┐
│              Page Components                 │
│        (TokenPage, HomePage, ...)            │
├─────────────────────────────────────────────┤
│           Zustand Store (状态层)              │
│       tokens / user / sync / ...             │
├────────────────────┬────────────────────────┤
│   Local Adapter    │    Cloud Adapter        │
│   (IndexedDB)      │    (Axios API)          │
│   via Dexie        │    /forge/*             │
├────────────────────┴────────────────────────┤
│            Sync Engine (同步引擎)             │
│   写入时双写 / 登录时推同步 / 冲突检测          │
└─────────────────────────────────────────────┘
```

## 模块设计

### 1. 本地数据库 — `src/lib/db.ts`

使用 **Dexie**（IndexedDB 封装库）定义本地数据库。

```
数据库名: forge-db
表: tokens (后续扩展: navLinks, settings, ...)
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

### 2. 本地适配器 — `src/lib/adapters/local-adapter.ts`

实现统一 `StorageAdapter<T>` 接口：

- 所有 CRUD 操作走 Dexie
- 创建时生成 `_localId`（UUID），`_synced: false`
- 更新时更新 `_updatedAt`，`_synced: false`
- 删除时标记 `_deleted: true`，不物理删除（等同步后清理）

### 3. 存储路由升级 — `src/lib/storage.ts`

根据登录状态选择适配器：

```ts
function getTokenStorage(): StorageAdapter<Token> {
  if (authStore.getState().isLoggedIn) {
    return cloudTokenAdapter;  // 已登录走云端
  }
  return localTokenAdapter;    // 未登录走本地
}
```

### 4. 同步引擎 — `src/lib/sync.ts`

**触发时机：**
- 登录成功后 → 推同步（本地 → 云端）
- 登录状态下每次本地写入 → 双写（本地 + 云端）
- 定时拉取（可选，轮询或 WebSocket）

**同步策略：**
1. **登录时推同步**：扫描本地 `_synced === false` 的记录，逐条调云端 create/update，成功后标记 `_synced: true`
2. **已登录状态下的写入**：同时写本地和云端，云端失败不影响本地写入（标记 `_synced: false` 等待重试）
3. **冲突检测**：基于 `updated_at` 时间戳，云端更新则拉取覆盖本地；本地更新则推送覆盖云端（last-write-wins）
4. **删除同步**：本地软删除 `_deleted: true` → 同步时调云端 delete → 成功后物理删除本地记录

### 5. 依赖安装

```bash
npm install dexie
```

### 6. 工具函数 — `src/lib/uuid.ts`

UUID 生成，用于 `_localId`。

## 实施步骤

| 步骤 | 内容 | 涉及文件 |
|------|------|----------|
| 1 | 安装依赖：`dexie` | package.json |
| 2 | 创建 `lib/db.ts` — Dexie 数据库定义 | 新建 |
| 3 | 创建 `lib/uuid.ts` — UUID 工具 | 新建 |
| 4 | 创建 `lib/adapters/local-adapter.ts` — IndexedDB 适配器 | 新建 |
| 5 | 改造 `lib/storage.ts` — 根据登录态切换适配器 | 改造 |
| 6 | 创建 `lib/sync.ts` — 同步引擎 | 新建 |
| 7 | 改造 `stores/tokens.ts` — 登录后触发同步 | 改造 |
| 8 | 登录成功后执行首次同步 | 改造 `stores/auth.ts` |

## 新增/改造文件

```
src/
  lib/
    db.ts               # Dexie 数据库定义 (新增)
    uuid.ts             # UUID 生成工具 (新增)
    storage.ts          # 存储路由 (改造：增加本地适配器)
    sync.ts             # 同步引擎 (新增)
    adapters/
      local-adapter.ts  # IndexedDB 适配器 (新增)
  stores/
    auth.ts             # 认证 store (改造：登录后触发同步)
    tokens.ts           # 密钥 store (改造：支持双写)
```

## 验证方式

1. **未登录模式**：清除 JWT → 创建密钥 → 刷新页面 → 数据仍在（IndexedDB）
2. **登录同步**：登录 → 本地未同步数据自动推到云端 → 云端数据拉到本地
3. **双写验证**：已登录状态创建密钥 → 本地和云端都有记录
4. **离线容错**：断网状态下创建密钥 → 恢复网络后自动同步
5. **登出隔离**：登出后只看到本地数据，云端数据不可见
