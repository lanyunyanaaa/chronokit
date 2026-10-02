# ChronoKit

**开源的视频时间与元数据工作台 · Open-source video timestamps toolbox**

ChronoKit 帮你检查、修复、批量编辑视频的"时间"——容器元数据 `creation_time`、
文件修改时间、NTFS 创建时间——全过程支持预览（dry-run）、集中备份与跨会话撤销。

> 100% 本地运行。无账号、无遥测。

## 安装

1. 下载 `ChronoKit Setup x.x.exe`（安装版）或 `ChronoKit x.x.exe`（便携版，解压即用）。
2. 双击运行。Windows SmartScreen 提示"未签名"时：点 **更多信息 → 仍要运行**。
3. 应用内置 ffmpeg，无需额外安装；也支持 `CK_FFMPEG_DIR` 指向自定义 ffmpeg 目录。

## 三步上手

1. **加文件** —— 把文件夹或文件拖进任意面板（或点"添加"）。"智能导入"会自动递归扫描，
   把同名"原件 / 转存件"配对。
2. **选工具** ——
   - **同步时间**：把源视频的真实时间复制到目标视频（重编码/转存后时间丢失的场景），
     智能匹配（同名 → 模糊名 → 大小 → 时长）+ 手动改绑。
   - **时间工具**：无源文件时直接设定绝对时间、批量偏移（如 +8h 时区修正）、
     或从文件名解析时间（支持 `VID_…`、`IMG_…`、`Screenshot_…`、`mmexport…` 等常见模式）。
3. **执行并撤销** —— 先"预览变更"确认 dry-run 对照表，再执行。每次写入都记入
   **操作历史**，随时一键撤销（含集中备份，重启应用后依然可撤销）。

## 常见问题

- **SmartScreen 拦截**：应用未做代码签名。点"更多信息 → 仍要运行"即可；或使用便携版。
- **写入了错误时间**：打开"操作历史"页，找到该批次，点"撤销"。
- **FFmpeg 状态**：窗口左下角有状态指示；打包版自带 ffmpeg，开发模式可用系统 PATH 中的 ffmpeg。

## 开发

```bash
pnpm install
pnpm dev        # 运行应用
pnpm test       # vitest 单元测试（核心逻辑）
pnpm typecheck  # TS 类型检查
pnpm icons      # 从 build/icon.svg 生成 icon.ico/png（需要 electron）
pnpm ffmpeg:fetch  # 把 ffmpeg/ffprobe 落地到 resources/ffmpeg（PATH 复制或下载 LGPL 构建）
pnpm dist       # 打包 Windows 安装版 + 便携版（electron-builder）
```

FFmpeg/ffprobe 解析顺序：`CK_FFMPEG_DIR` 环境变量 → 打包内置 `resources/ffmpeg` → 系统 PATH。
打包前会自动执行 `ffmpeg:fetch`，并在 `beforePack` 钩子校验二进制存在。

## License

[MIT](./LICENSE)
