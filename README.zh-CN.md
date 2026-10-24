<div align="center">

<img src="build/icon-256.png" width="96" alt="ChronoKit 图标">

# ChronoKit

**开源的视频时间与元数据工作台**

检查、修复、批量编辑视频与照片的"时间"——容器元数据、文件修改时间、
NTFS 创建时间——全过程支持预览（dry-run）、集中备份与完整撤销。

[![CI](https://github.com/lanyunyanaaa/chronokit/actions/workflows/ci.yml/badge.svg)](https://github.com/lanyunyanaaa/chronokit/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-1677ff.svg)](./LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows-1677ff.svg)](#下载安装)
[![Electron](https://img.shields.io/badge/Electron-33-1677ff.svg)](https://www.electronjs.org/)

[English](README.md) | 简体中文

</div>

> **100% 本地运行。** 无账号、无遥测、无云端，文件不离开你的电脑。

## 为什么需要 ChronoKit？

视频经过重编码、转存或"清理"后，真实拍摄时间常常被抹掉——文件看起来像
复制那天才"出生"。ChronoKit 从源文件读出**真实时间**（容器元数据、文件名
模式或文件系统时间），写回目标文件，并且每一步都可回退：先预览、自动
备份、一键撤销。

## 功能

| 工具 | 说明 |
| --- | --- |
| **同步时间** | 把源视频的真实时间复制到目标视频。智能导入自动配对"原件 / 转存件"（同名 → 模糊名 → 大小 → 时长），支持手动改绑。 |
| **时间工具** | 设定绝对时间、批量偏移（如 `+8h` 时区修正）、或从文件名解析时间（`VID_…`、`IMG_…`、`Screenshot_…`、`mmexport…` 等常见模式）。 |
| **检查器** | 看清文件内部：容器 `creation_time`、文件系统 mtime/ctime、照片 EXIF 拍摄时间。 |
| **批量表格** | 类电子表格的批量编辑——整列设值、偏移、列间复制，虚拟滚动支撑大批量。 |
| **智能重命名** | 按时间戳重命名媒体文件，三种模板 + 冲突策略，全程可撤销。 |
| **体检中心** | 规则引擎扫描时间库里的常见问题，一键修复。 |
| **备份中心** | 每次写入按操作集中备份，支持单文件还原、按批次浏览。 |
| **操作历史** | 持久化日志——任何写入都可撤销，重启应用后依然可以。 |

**会写入什么**

- 视频：容器元数据 `creation_time`（ffmpeg remux）+ 文件系统 mtime/ctime。
- 照片（JPEG/PNG）：EXIF 拍摄时间**只读**；写入只涉及文件系统时间——
  在 EXIF 写入功能落地前，照片容器元数据绝不改写（安全优先）。

## 下载安装

到 [**Releases**](https://github.com/lanyunyanaaa/chronokit/releases) 页面下载最新版：

| 文件 | 类型 |
| --- | --- |
| `ChronoKit Setup x.x.exe` | Windows 安装版（NSIS） |
| `ChronoKit x.x.exe` | 便携版——单文件，解压即用 |

- 内置 ffmpeg，无需额外安装；也可用 `CK_FFMPEG_DIR` 指向自定义 ffmpeg 目录。
- 安装包尚未做代码签名。SmartScreen 提示时，选择**更多信息 → 仍要运行**。

<div align="center">
  <img src="docs/screenshots/sync.png" alt="同步时间页面" width="820">
  <p><sub>同步时间 —— 配对源与目标，预览方案，一键执行。</sub></p>
</div>

## 三步上手

1. **加文件** —— 把文件夹或文件拖进任意页面（或点"添加"）。智能导入会自动
   递归扫描，把同名"原件 / 转存件"配对。
2. **选工具** —— 从源文件同步时间，或直接编辑（绝对时间、偏移、文件名解析）。
3. **预览后执行** —— 每次写入都先出 dry-run 对照表；写入自动备份并记入
   操作历史，随时一键撤销（重启后依然可撤销）。

<div align="center">
  <img src="docs/screenshots/tools.png" alt="时间工具页面" width="49%">&nbsp;
  <img src="docs/screenshots/checkup.png" alt="体检中心页面" width="49%">
  <p><sub>时间工具 · 体检中心</sub></p>
</div>

## 开发

环境要求：**Node.js ≥ 20** 与 **pnpm 9**；打包需在 Windows 上进行。

```bash
pnpm install
pnpm dev           # 运行应用
pnpm test          # vitest 单元测试（核心逻辑）
pnpm typecheck     # TypeScript 类型检查（node + web）
pnpm icons         # 从 build/icon.svg 重新生成 icon.ico/png
pnpm ffmpeg:fetch  # 把 ffmpeg/ffprobe 落地到 resources/ffmpeg（PATH 复制或下载 LGPL 构建）
pnpm dist          # 打包 Windows 安装版 + 便携版（electron-builder）
```

ffmpeg/ffprobe 解析顺序：`CK_FFMPEG_DIR` 环境变量 → 打包内置
`resources/ffmpeg` → 系统 `PATH`。`pnpm dist` 会自动获取 ffmpeg，且
`beforePack` 钩子会校验二进制存在。

### 目录结构

```
src/core/       纯 TypeScript 领域逻辑（计划、匹配、EXIF、重命名…）+ 单元测试
src/main/       Electron 主进程服务（journal、备份、媒体探测、会话）
src/renderer/   React + antd 界面（页面、store、设计系统）
docs/           路线图、UI 设计系统、截图
```

## 路线图

见 [docs/ROADMAP.md](docs/ROADMAP.md)。接下来：

- **U2b** —— 照片 EXIF **写入**（JPEG 先行），同样带预览 / 备份 / 撤销
- **U3** —— 自动更新、macOS / Linux 构建、CLI

## 参与贡献

欢迎贡献！请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 了解环境搭建与约定，
也可以到 [路线图](docs/ROADMAP.md) 里找合适的切入点。

## 安全

发现漏洞请私下报告，见 [SECURITY.md](SECURITY.md)。

## 许可证

[MIT](./LICENSE) © ChronoKit contributors。
内置的 ffmpeg 为 LGPL 授权构建，它是独立程序，不影响 ChronoKit 本身的许可证。
