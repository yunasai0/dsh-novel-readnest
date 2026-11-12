# 参与开发

欢迎通过 Issue 提交问题和建议，通过 Pull Request 提交改进。

## 本地开发

使用 Node.js 24 或更新版本、pnpm 11 和 Git。

```sh
pnpm install --frozen-lockfile
pnpm run build
```

构建脚本会安装 `vendor/readest/` 的锁定依赖，检查类型，并生成 `lib/` 和 `reader/`。阅读器适配代码遵循该目录中的 `AGENTS.md`。

尽量复用已有 Readest 页面与 DSH 原生组件。一个改动围绕一个具体目标，保留与目标无关的现有行为。

## 验证

只修改 DSH 源码时可先运行 `pnpm run check`。涉及阅读页或构建配置时运行完整构建。

行为改动应在独立 DSH 配置中验证，使用测试书籍。按改动范围检查 TXT、EPUB、阅读进度、AI 会话和防剧透，并在 PR 中说明实际验证的环境与结果。

升级时需要兼容既有站点数据与会话。阅读路由、存储键和 Agent 预设 ID 具有兼容性意义，修改这些标识时应提供迁移方案。

小说统一索引保存到书籍目录的 `novel-index.json`。阅读器目录和 Agent 查询必须复用该索引，不能各自推算章号；`read_chapters` 只匹配索引中的原书章号，`read_chapter_ids` 只接受返回的 `chapter_id`。修改索引语义时升级 `NOVEL_INDEX_VERSION` 并检查旧书重建、ID 稳定性、正文连续覆盖、目录跳转及防剧透。原文顺序、已有 CFI 和阅读坐标不能因重建索引而改变。

工具链回归在 `vendor/readest/apps/readest-app/` 运行 `pnpm test --run src/__tests__/services/dshBookText.test.ts src/__tests__/services/dshSyncFlow.test.ts src/__tests__/services/dshSyncHistory.test.ts src/__tests__/services/dshNovelTools.test.ts src/__tests__/services/dshCompanion.test.ts src/__tests__/services/dshReadingBoundary.test.ts`。完整构建后，在根目录运行 `node scripts/validate-reading-tools.mjs`，使用真实阅读页面检查当前片段、增量同步、跳读、共享额度、重连续读及跨文件双页；结果写入 `dist/reading-tools-validation/`。脚本模拟会话完成事件，不调用模型服务；Chrome 路径可通过 `CHROME_PATH` 指定。

长篇性能验证可运行 `node scripts/validate-novel-import.mjs <小说.txt> original,original,original <输出目录>`。原版使用本机文件路径选择，避免把自动化内存上传的解码开销混入插件耗时；格式破坏样本仍在内存中生成，其上传耗时不直接用于性能对比。进度截图可设置 `NOVEL_CAPTURE_PROGRESS=1`，截图运行不计入性能基准。检查正文校验、章节 ID 及 Worker 回退记录，不能仅比较耗时。

## 提交与发布

更新根目录的 `package.json` 版本与 `CHANGELOG.md`，同步 README 中的安装示例，然后执行构建和打包。

```sh
pnpm run build
npm run pack:release
```

打包脚本会生成 `dist/dsh-novel-readnest-<版本>.tgz` 与对应的 SHA256 文件。检查包中的版本、入口和静态资源，再用独立配置安装验证。

GitHub 直装使用预构建资源，发布提交应包含 `src/`、`vendor/`、`lib/`、`reader/` 和构建配置。根目录 `docs/` 用于本地设计材料，已列入忽略规则，发布提交与标签均排除该目录。

完成验证后推送发布提交和 `v<版本>` 标签，创建对应的 GitHub Release，上传插件包及校验文件。预发布版本在 Release 中标记为 pre-release。

## 报告问题

请提供插件版本、DSH 版本、宿主系统、安装方式、复现步骤及预期结果。涉及书籍格式时，优先提供可公开的最小示例。

依赖和第三方代码变更应保留原许可证。许可证与来源说明见 `LICENSE` 和 `NOTICE.md`。
