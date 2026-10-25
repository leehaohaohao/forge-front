# 保险库请求生命周期修复

日期：2026-10-25

## 修复

开发模式 StrictMode 会重复执行 effect 的 setup/cleanup。原来的清理仅调用 operation.done() 移除请求登记，旧请求仍可返回；父页面锁定保险库后 epoch 改变，旧回调 guard() 抛出 STALE 并弹出错误提示。

- operation 新增 cancel()，同时 abort 信号并移除登记；done() 仍用于正常完成后的释放，不改变既有会话版本检查。
- VaultPanel 每轮 effect 建立独立生命周期，跟踪状态读取及用户操作。清理时先标记失效、移除订阅，再取消仍在进行的操作。
- 旧生命周期的成功、失败和 finally 回调不更新界面、不显示提示、不重置新生命周期的忙碌状态。
- 自动锁定、Worker 清理和 guard() 保留；取消导致的 STALE 不误报，当前页面真实服务错误及错误密码仍显示。

## 验证

- `npm run build`：类型检查与生产构建通过，保留既有 bundle 体积提示。
- `scripts/test-vault-lifecycle.cjs`，VAULT_DEV_URL 指向真实 Vite 开发服务：直接打开页面无提示；延迟读取后切页，真实 Axios AbortSignal 被取消；旧成功/失败响应均不提示；创建过程读取未结束时切页无写入；当前挂载的服务失败只提示一次；cancel 和会话版本 guard 仍拒绝旧操作。
- 生命周期测试使用开发入口的 React StrictMode，而不是手工模拟 effect 重放。接口为 fixture，不涉及业务数据。
- `scripts/test-vault-page.cjs`：生产页面验证错误密码、自动锁定、过期响应、恢复材料及密钥操作，确认生命周期隔离不影响正常流程。

工作按独立 bug 分支提交并提 PR，不合并或部署生产。
