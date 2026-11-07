# 来源与第三方说明

DSH ReadNest 基于 Readest 适配，由 yunasai0 维护插件集成。

- Readest 上游源码来自 https://github.com/readest/readest，当前保留的应用版本为 `0.12.16`。适配后的源码位于 `vendor/readest/`，原许可证位于 `vendor/readest/LICENSE`。
- Readest 使用 Foliate 的电子书解析与呈现组件，相关源码和许可证保留在 `vendor/readest/packages/foliate-js/`。
- 随阅读器提供的 PDF.js、字体、WASM 等资源保留各自的许可证文件。其他依赖的版本与来源记录在根目录及 Readest 工作区的锁文件中。

DSH ReadNest 使用 AGPL-3.0-or-later。分发修改版本时，请保留原有版权与许可证说明，并按照许可证要求提供相应源码。

DSH 的运行时与模型服务由宿主提供，其许可与服务条款由对应项目和服务商决定。
