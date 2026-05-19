# Pocket Workbench (口袋工作台) - 项目计划

## 技术栈

| 类别 | 选型 |
|------|------|
| 构建工具 | Vite |
| 框架 | React 18 + TypeScript |
| UI 库 | Material UI (MUI) v5 |
| 路由 | React Router v6 |
| 状态管理 | Zustand |
| Markdown 编辑器 | @uiw/react-md-editor |
| 代码高亮 | react-syntax-highlighter |
| HTTP 请求 | Axios |
| Markdown 渲染 | react-markdown + remark-gfm |
| 后端 | Java（自行开发） |

## 项目结构

```
src/
├── api/                  # API 抽象层
│   ├── request.ts        # Axios 实例 + 拦截器
│   ├── mock/             # Mock 数据（开发阶段）
│   │   ├── navigation.ts
│   │   ├── blog.ts
│   │   ├── keys.ts
│   │   ├── snippets.ts
│   │   └── auth.ts
│   ├── navigation.ts     # 导航页 API
│   ├── blog.ts           # 博客 API
│   ├── keys.ts           # 密钥管理 API
│   ├── snippets.ts       # 碎片信息 API
│   └── auth.ts           # 认证 API
├── components/           # 公共组件
│   ├── Layout/           # 主布局（侧边栏 + 顶栏）
│   ├── SearchBar/        # 搜索框组件
│   ├── MarkdownEditor/   # Markdown 编辑器封装
│   ├── CodeBlock/        # 代码高亮组件
│   ├── ConfirmDialog/    # 二次确认弹窗
│   └── EmptyState/       # 空状态占位
├── pages/                # 页面
│   ├── Navigation/       # 导航页
│   ├── Blog/             # 博客（列表 + 编辑 + 阅读）
│   ├── Keys/             # AI密钥管理
│   ├── Snippets/         # 碎片信息存储
│   ├── Login/            # 登录
│   └── Register/         # 注册
├── stores/               # Zustand 状态管理
│   ├── authStore.ts      # 用户认证状态
│   ├── navStore.ts       # 导航数据
│   ├── blogStore.ts      # 博客数据
│   ├── keysStore.ts      # 密钥数据
│   └── snippetStore.ts   # 碎片数据
├── types/                # TypeScript 类型定义
│   ├── navigation.ts
│   ├── blog.ts
│   ├── key.ts
│   ├── snippet.ts
│   └── user.ts
├── theme/                # MUI 主题配置
│   └── index.ts
├── routes/               # 路由配置
│   └── index.tsx
├── App.tsx
└── main.tsx
```

## 页面功能设计

### 1. 浏览器导航页 (Navigation)
- 顶部：搜索引擎切换搜索框（Google / Bing / 百度 / GitHub）
- 主体：分类卡片网格（开发工具、AI、资讯、娱乐等）
- 每个卡片显示：图标 + 名称 + 简介
- 支持增删改查
- 自定义背景（纯色/渐变/图片URL）

### 2. 个人博客 (Blog)
- 列表页：文章卡片 + 时间线视图，支持分类/标签筛选
- 编辑页：Markdown 编辑器 + 实时预览，支持分类和标签
- 阅读页：渲染后的 Markdown，目录导航

### 3. AI密钥管理 (Keys)
- 密钥列表：厂商、用途备注、脱敏显示（sk-****xxxx）
- 点击显示完整密钥（需二次确认弹窗）
- 一键复制
- 新增/编辑/删除密钥
- 支持备注：用途、额度、过期时间

### 4. 碎片信息存储 (Snippets)
- 列表：标签 + 标题 + 时间
- 新增/编辑：标题、内容（支持纯文本/代码/配置）
- 代码语法高亮
- 标签分类 + 搜索

### 5. 登录/注册
- 登录页：用户名 + 密码
- 注册页：用户名 + 密码 + 邀请码
- Token 存储在 localStorage，Axios 拦截器自动携带

## 实施步骤

### Step 1: 项目初始化
- Vite 创建 React + TS 项目
- 安装所有依赖
- 配置 MUI 主题
- 清理模板文件

### Step 2: 基础架构搭建
- 路由配置（带认证守卫）
- 主布局组件（MUI Drawer 侧边栏 + AppBar 顶栏）
- Axios 请求封装 + Mock 数据层
- Zustand stores 骨架
- TypeScript 类型定义

### Step 3: 登录/注册页
- 登录表单 + 注册表单（含邀请码）
- authStore 管理 token 和用户信息
- 路由守卫：未登录跳转登录页

### Step 4: 导航页
- 搜索框组件（多搜索引擎切换）
- 分类卡片网格
- 网站的 CRUD 操作弹窗
- 背景自定义

### Step 5: AI密钥管理
- 密钥列表表格
- 脱敏显示 + 二次确认显示完整密钥
- 复制功能
- 新增/编辑表单

### Step 6: 碎片信息存储
- 碎片列表
- 编辑器（支持代码高亮）
- 标签管理 + 搜索

### Step 7: 博客模块
- 文章列表 + 时间线
- Markdown 编辑器
- 文章阅读页 + 目录
- 分类/标签

### Step 8: 完善与优化
- 响应式适配
- Loading / Error / Empty 状态处理
- 本地持久化（localStorage fallback）
- 整体 UI 打磨
