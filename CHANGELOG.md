# 版本更新

## 0.2.0-beta.5 · 2026-11-07

- 以 DSH ReadNest 名称首次公开发布，包名为 `dsh-readnest`。
- 加入「大肥鱼」内置可选 Agent 人设，提示词保存在 `src/personas/da-fei-yu.json`。
- 支持在设置页和会话顶部直接选择「大肥鱼」，编辑名称及完整提示词后保存，从下一条消息生效。
- 已有用户升级后自动获得此预设，用户保存的编辑与删除操作会持久保留。
- 同步更新 DSH Client 与 Readest 静态资源，供 GitHub 直装及通用插件包使用。

本版已在 Windows 本机官方 DSH Web `0.2.1-rc.2` 验证人设选择、编辑保存和真实对话，并在已有书库的环境完成更新，检查了阅读进度与既有会话内容。

发布附件为 `dsh-readnest-0.2.0-beta.5.tgz` 和对应的 `.tgz.sha256` 校验文件。GitHub 直装使用 `v0.2.0-beta.5` 标签，仓库包含 `lib/` 与 `reader/` 预构建资源。
