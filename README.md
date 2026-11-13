# DSH Novel ReadNest

基于 Readest 的 DSH 小说阅读插件，将本地书库、阅读器和书内 AI 会话放在一起。

[![Release](https://img.shields.io/github/v/release/yunasai0/dsh-novel-readnest?include_prereleases)](https://github.com/yunasai0/dsh-novel-readnest/releases)
[![License](https://img.shields.io/badge/license-AGPL--3.0-blue)](LICENSE)

## 功能

- 导入 TXT、EPUB，管理本地书架，记录阅读位置并继续阅读。
- 导入时整理统一章节索引，为每个章节分配稳定的 `chapter_id`；重复章号不会混淆，无法可靠分章的内容标为「未分章正文」。
- 复用 Readest 的主题、字体、布局、目录、搜索、笔记和朗读界面。
- 每本书拥有独立的 Agent 会话列表，可新建、切换和管理会话。
- 复用 DSH 原生会话、输入栏和运行轨迹，支持引用选中文字与 AI 讨论。
- Agent 主动调用工具读取当前片段、同步新增阅读内容，或按原书章号、章节 ID 查询正文；所有正文工具共享每轮 30,000 字符额度。开启防剧透后，读取截止于发送消息时本书已记录的最远阅读位置，回翻不缩小可查范围。
- 内置默认人设和可编辑的「大肥鱼」人设，可在设置或会话顶部切换，从下一条消息生效。

## 功能截图

### 本地书库

在「我的书房」管理导入的小说，查看阅读进度，并从上次的位置继续阅读。

![本地书架和继续阅读卡片](assets/screenshots/01-bookshelf.png)

### 桌面阅读

桌面阅读页支持双栏排版，可在侧边目录切换章节，也可选中文字进行标注或向 AI 提问。

![桌面双栏阅读、章节目录和选区工具栏](assets/screenshots/02-desktop-reader.png)

### 书内 AI 对话

阅读时可在正文旁打开本书的 AI 会话，选择「大肥鱼」等人设，并通过防剧透开关控制 Agent 可读取的正文范围。

![正文与大肥鱼 AI 会话并排显示](assets/screenshots/03-ai-chat.png)

### 窄屏阅读

窄屏下使用单栏正文，目录、配色、阅读进度、字体和朗读控件集中在底部。

<img src="assets/screenshots/04-narrow-reader.png" alt="窄屏单栏阅读和底部工具栏" width="360">

## 安装

支持官方 DSH `0.2.1` 系列（从 `0.2.1-rc.2` 起）及 `0.2.2-rc.1`、`0.2.2-rc.2`。插件包包含预构建模块与阅读页面，安装后由 DSH 直接加载。

### DSH Web

```sh
dsh plugin --profile web add "github:yunasai0/dsh-novel-readnest#v0.2.0-beta.11"
```

完成安装后，按 DSH 提示重启 Web 服务，刷新页面，从侧边栏「小说阅读」进入。

### DSH 桌面版

`v0.2.0-beta.7` 已在 Windows 和 macOS 官方桌面版实测，可正常安装和使用。在「插件 → 添加插件」中填写下列 GitHub 地址，安装并启用。

```text
https://github.com/yunasai0/dsh-novel-readnest
```

也可以在添加插件时填写 Release 附件的下载地址。Web 与桌面版使用同一份通用包。

```text
https://github.com/yunasai0/dsh-novel-readnest/releases/download/v0.2.0-beta.11/dsh-novel-readnest-0.2.0-beta.11.tgz
```

下载与校验文件见 [Releases](https://github.com/yunasai0/dsh-novel-readnest/releases)。

### 升级到最新版本

本次版本为 `v0.2.0-beta.11`。已安装用户可在插件管理中使用本版 Release 安装包更新；DSH Web 可重新执行上面的安装命令，指向新版本标签。更新后重启对应的 DSH 服务或桌面应用，再刷新阅读页面。

固定到旧标签或旧 Release 安装包的安装不会因仓库推送自动切换版本。无需删除书库或会话数据；更新后确认插件版本显示为 `0.2.0-beta.11`。

### 手机和平板

使用浏览器访问你部署的 DSH Web。手机端已通过真机使用测试，阅读界面适配窄屏，AI 面板以可下拉收起的浮层展开。第三方 DSH 客户端需要支持官方版本的插件协议。

## 开始使用

1. 在「小说阅读」中导入 TXT 或 EPUB，打开书籍阅读。
2. 配置好 DSH 的模型后，点击阅读页顶部的「AI」，创建本书会话。
3. 选中文字后，可点击选区工具栏中的 AI 图标，将原文带入最近使用的本书会话。
4. 在「设置 → Agent 预设」中选择人设，或编辑「大肥鱼」的名称和提示词并保存。

从 `v0.2.0-beta.8` 起，人设提示词不再受原有的 4,000 字符限制，可保存更长的人设内容，并从下一条消息生效。

防剧透开关位于 AI 会话顶部。当前页面和选区决定讨论位置，防剧透边界则取本书曾显示过的最远正文位置，两者分别记录。直接跳到后面的页面也会推进边界；普通阅读时即可记录，无需打开 AI 面板。每条消息锁定发送时的边界，后续翻页影响下一条消息。

关闭防剧透后，Agent 可以查询当前绑定书籍的全书正文，但它查到的后文不会推进用户的阅读边界。重新开启时，若会话已查过最远阅读位置之后的内容，需要新建会话，或读到该位置后继续。旧版本未记录的历史最远位置无法还原，升级后从当前页面开始累计。

正常在同一页连续讨论不会要求新开会话；“没有新正文”的同步结果也不算查阅后文。`v0.2.0-beta.11` 修复了旧版对此类空结果的误判，升级并重启后可重新打开受影响的原会话继续讨论。

## 数据与服务

书籍、统一章节索引、阅读进度、每本书的最远阅读位置、笔记和人设设置保存在当前浏览器或桌面窗口的站点存储中。AI 会话保存在 DSH 数据目录。

新书在导入完成前建立索引，旧书在首次打开时补建。索引保留原文顺序，不根据章号重排或删除重复正文，也不改变原有阅读定位和笔记。TXT 自动分块只是内部存储结构；新导入的无标题长正文不会把这些块显示成虚构章节。

长篇导入会显示「整理正文 → 建立目录 → 保存书籍」的实际阶段和进度。支持的浏览器会在后台线程整理 TXT；首次打开直接使用已完成的统一索引，避免再次建立另一份目录。

支持识别带常见装饰前缀的章节标题，统一处理 CR、CRLF、LF 换行，并将密集的打印目录单独标记。能够判断的标题正文粘连会分开整理，正文中的说明句不会仅因含有「第几篇」就变成章节。索引算法升级时会重建缓存；旧会话中失效的章节 ID 需要通过目录重新获取。

Agent 工具分别处理当前片段、增量同步、原书章号、章节 ID、目录和续读。`read_chapters` 的数字只表示原书章号，重号时通过卷名消歧；`read_chapter_ids` 的 ID 只从快照或目录复制，不能用文件序号或旧 `section-*` ID 代替。旧 `read_novel` 已拆分，旧会话记录仍可查看。

```text
read_current({})                     → 当前选区或可见正文，补前约 3 段、后约 2 段
sync_reading({})                     → 同步本会话尚未同步的实际阅读区间
read_chapters({"start":12,"end":14,"volume":"第二卷"}) → 按原书章号读取
novel_chapters({"chapter_numbers":[12,15],"volume":"第二卷"}) → 查可读目录
read_chapter_ids({"chapter_ids":["目录返回的ID"]}) → 读取明确选中的章节
continue_reading({"cursor":"返回的next_cursor"}) → 继续原任务
```

正文由 Agent 按需获取，不会在每次发消息时自动附上当前页或累计已读正文；用户主动引用的选区仍随消息提供。首次增量同步只取当前片段，之后补齐实际浏览过的区间，跳读不会自动加载中间章节。同步进度仅在正文成功交付且本轮正常完成后确认，取消或失败后可以重试。

当前片段优先保持段落完整，通常约 2,000 字，不另设固定字数上限。所有正文查询累计使用同一轮的 30,000 字符额度；达到额度后按 `next_call.when` 在下一轮续读。游标固定原任务的起点、终点与权限，后续翻页不会扩大原任务；碰到防剧透边界时停止，不提供越界续读。结果包含停止原因、定位和恢复提示。

朗读、外部词典和翻译依赖对应服务的可用性。AI 对话使用 DSH 中配置的模型与服务商。

## 兼容性与验证

| 环境 | 验证情况 |
| --- | --- |
| Windows DSH Web `0.2.1-rc.2` | 已验证 TXT、EPUB、续读、Agent 查章、防剧透、朗读及人设切换 |
| Windows DSH Web `0.2.2-rc.1` | 已验证安装、TXT 导入、打开正文和创建 AI 会话 |
| Windows DSH Web `0.2.2-rc.2` | `v0.2.0-beta.10` 已验证兼容性检查、安装启动、TXT 导入、打开正文和创建书内 AI 会话；未调用模型服务 |
| Windows 官方桌面版 | `v0.2.0-beta.7` 已实测可正常安装和使用 |
| macOS 官方桌面版 `0.2.2-rc.1` | `v0.2.0-beta.7` 已实测可正常安装和使用 |
| 手机端 | 已在手机真机上验证可正常使用 |

## 源码与构建

```text
src/               DSH Host、Client、Agent 与阅读协议
src/personas/      随插件提供的可编辑人设
vendor/readest/    适配后的 Readest 源码及其依赖锁文件
scripts/           构建和发布打包脚本
lib/               DSH 加载的预构建模块
reader/            预构建阅读页面与静态资源
cordis.patch.yml   DSH bundle 与 Agent 工具装配
```

维护者需要 Node.js 24 或更新版本，以及 pnpm 11。

```sh
pnpm install --frozen-lockfile
pnpm run build
npm run pack:release
```

发布脚本在 `dist/` 中生成带版本号的 `.tgz` 和 `.tgz.sha256`。GitHub 直装所需的 `lib/` 与 `reader/` 随源码提交。

构建、贡献与发布约定见 [CONTRIBUTING.md](CONTRIBUTING.md)，版本变更见 [CHANGELOG.md](CHANGELOG.md)。问题和建议请提交到 [Issues](https://github.com/yunasai0/dsh-novel-readnest/issues)。

## 许可证与致谢

本插件基于 [Readest](https://github.com/readest/readest) 适配，使用 AGPL-3.0-or-later。完整许可证见 [LICENSE](LICENSE)，来源与第三方说明见 [NOTICE.md](NOTICE.md)。
