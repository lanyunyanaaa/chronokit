# ChronoKit 性能优化分析与 UI 重构方案

> 2026-09-29 · 基于 v0.1.0 (commit 2462358) 全量代码走读 · 与 ROADMAP U0/U1 对齐
> 结论先行：性能问题集中在四条链路——**探测(probe)全串行且无缓存、缩略图走 base64 IPC、执行器备份全量拷贝且串行、渲染层无虚拟化且 store 整列表更新**。UI 重构的核心不是换皮，而是**把"单一大 store + 页面内联一切"重排为"归一化媒体索引 + 共享组件原语"**，这恰好是 U1 四个新页面（体检/表格/重命名/备份中心）的地基。

---

# A. 性能优化分析

## A0. 前提：先建基准，再谈优化

当前没有任何测量手段，以下数字均为工程估算（ffprobe 单次 spawn 在 Windows 上约 80-300ms）。动手前先做两件事，否则无法验证收益：

1. **基准夹具**：`scripts/bench-fixture.mjs`——用系统 ffmpeg 生成 N 个 5 秒小视频（`-f lavfi testsrc`），N=100/500/2000 三档，落在 `.bench/`（gitignore）。
2. **计时日志**：主进程批量任务（probe/stat/exec）记录 `started/finished/duration/count` 到控制台与 `.data/perf.log`，dev 模式渲染层显示 overlay。改动前后各跑一次同规模夹具。

## A1. 发现清单（按收益/成本比排序）

### P1 · probe 全串行 + 无缓存 —— 最大的单点瓶颈

- 位置：`src/main/services/probe.ts:83-97`（`probeFiles` for 循环逐个 await）；`src/renderer/src/store/appStore.ts:113-137`（`reprobe` 整批等完才 set）。
- 问题：500 个文件 = 500 次串行 ffprobe spawn，约 1-2.5 分钟；且**每次执行后 `reprobe` 会把刚改过的文件全部重跑 ffprobe**（`SyncPage.tsx:82`），重开应用/切页面也无任何缓存。
- 方案：
  1. **有界并发**：worker pool 4-6 路（磁盘 SSD 上 ffprobe 主要是进程 spawn + 头部解析开销，并发近线性）。进度事件已有 150ms 节流（`ipc.ts:47-56`），保持。
  2. **磁盘缓存**：`probeCache` 以 `path|size|mtimeMs` 为键（与 `thumbs.ts:43-45` 的缩略图键同构）存 JSON 于 `.data/probe-cache/`，容量上限 LRU 清理。执行后的 reprobe 命中缓存后从分钟级降到毫秒级。
  3. **渐进回填**：渲染层把一次大 `probeFiles` 拆成 ~20 个/批的分块 invoke，完成一批 set 一批——用户看到行逐批从"加载中"变实，而不是全部转完才刷新（感知性能）。
- 预估：500 文件首次探测 1-2.5min → **15-40s**（并发）→ 重复探测 **<1s**（缓存）。
- 成本：1 天（含缓存与单测）。

### P2 · 缩略图：base64 穿 IPC + setThumb 整列表 O(N²)

- 位置：`src/main/services/thumbs.ts:49,61`（读盘后转 base64 data URL）；`src/renderer/src/store/appStore.ts:164-170`（`setThumb` 对整列表 map）；`src/renderer/src/components/Thumb.tsx:16-25`（每行挂载即请求）；`FileListPanel.tsx:126-148`（全量渲染无虚拟化）。
- 问题分三层：
  1. **传输**：384px JPEG 约 15-40KB，base64 膨胀 33%，走 contextBridge structured clone；500 个文件约 15-25MB 字符串驻留渲染层内存。
  2. **更新**：每张缩略图到达触发一次 `setThumb` → 整列表 map 产生新数组 → `FileListPanel` 全量重渲染。500 张 = 500 次全列表重渲染（O(N²) 次行 reconcile），这是渲染层卡顿的主因。
  3. **请求**：所有行（含视口外）挂载即排队 ffmpeg；`MAX_ACTIVE=3` 虽限了并发，但队列里 499 个都在等。
- 方案（正解是自定义协议）：
  - 主进程 `protocol.registerSchemesAsPrivileged` + `protocol.handle('ck-thumb', ...)`，以现有 md5 hash 为 URL（`ck-thumb://<hash>`）直接流式返回缓存 JPEG；渲染层 `<img src>` 直读，**IPC 载荷归零、store 不再存缩略图**（`VideoItem.thumb` 字段删除）。CSP 需放行 `img-src ck-thumb:`。
  - 过渡方案（若协议缓一步做）：`setThumb` 改为组件局部 state 而非全局 store，并加 `getThumbMany` 批量接口。
- 预估：500 文件列表从"滚动掉帧 + 内存 20MB+"到流畅、缩略图内存近零；顺带解决 U1 表格页的缩略图列。
- 成本：1 天（协议 + Thumb 改造 + CSP）。

### P3 · 执行器：备份全量拷贝 + 逐文件串行

- 位置：`src/main/services/backup.ts:6-13`（每次 `copyFile` 整文件）；`src/main/services/executor.ts:44-96`（for 循环串行：stat → 备份 → remux → setTimes）。
- 问题：对 2GB 视频改一次元数据 = 备份拷贝 2GB + ffmpeg remux 2GB ≈ **4GB 磁盘 I/O**，且文件间串行。备份目录会随每次编辑线性膨胀（同一文件反复编辑 = 反复全量拷贝）。
- 方案：
  1. **硬链接备份**：同卷时 `fsp.link`（瞬时、零空间），跨卷（EXDEV）回退 copyFile。安全性成立的前提是"写临时文件 + rename 替换原路径"——`writeMetadata`（`metadata.ts:32-61`）正是这个模式，rename 不会修改旧 inode，硬链接持续保住旧内容（git 对象同理）。备份中心（U1）的"清理"改为删链接。
  2. **文件级并发**：2-3 路 worker 同时 remux（SSD 上 remux 是 I/O 密集，近 2 倍墙钟收益）。journal 条目本就按文件独立，收集完一次性 `appendOp` 不变；ctime 批处理保持在最后。
  3. `undoOp`（`journal.ts:52-62`）同样并行化。
  4. `exec:apply` 进度每文件即发（`ipc.ts:64-66`），补上 probe 同款 150ms 节流。
- 预估：单文件 4GB I/O → **2GB**（硬链接）；批量墙钟时间 → **约减半**（2 路并发）；备份磁盘占用大幅下降。
- 成本：1-1.5 天（含跨卷回退与并发下的错误聚合测试）。

### P4 · 渲染层无虚拟化

- 位置：`FileListPanel.tsx:126-148`（自定义 div 全量渲染）；`SyncPage.tsx:218-226`（antd Table `pagination={false}` 无 virtual）。
- 问题：500+ 行 DOM 全量挂载，滚动与每次 store 更新都贵；U1 表格/体检页会把规模推到数千行。
- 方案：文件列表用 `@tanstack/react-virtual`（约 3KB，行高固定的场景极简）；antd Table（已是 5.21）直接开 `virtual` + `scroll.y`。虚拟化同时天然解决 P2-3（只有视口内的行挂载 → 缩略图请求自动限流，不需要 IntersectionObserver）。
- 成本：1 天，与 P2 同一 PR 做。

### P5 · 三列表重复存储、重复探测

- 位置：`appStore.ts:82-94`（`sources/targets/toolItems` 三份同构数组）；`addPaths` 按各自 kind 独立 `reprobe`。
- 问题：同一文件同时加进"时间工具"和"同步目标"会被探测两次、缩略图取两次；U1 的体检/表格再各自一份会更糟。也是 UI 重构 B4 的动机。
- 方案：归一化 `items: Record<path, VideoItem>` + 各页只存路径选择数组（详见 B4）。
- 成本：与 B4 合并实施（1 天，见 UI 部分）。

### P6 · matcher O(目标×源) 全对 Levenshtein

- 位置：`src/core/matcher.ts:100-124`（双重循环内 `nameSimilarity` 对每对做 DP，`matcher.ts:37-53`）。
- 问题：归一化名截断 64 字符，DP 最坏 4096 格/对。500×500 = 25 万对 ≈ 1-3 秒；1000×1000 ≈ 4-10 秒，**且跑在渲染主线程上，UI 冻结**。当前几十个文件的典型场景没问题，体检/U1 规模会爆。
- 方案（三层，前两层几乎免费）：
  1. **精确桶**：先按归一化名 hash 分桶，`exact-name` 在桶内 O(1) 命中，大多数真实配对（同名副本）根本不用进模糊比较。
  2. **长度差预筛**：`1 - dist/maxLen ≥ 0.62` 要求 `dist ≤ 0.38×maxLen`，而长度差是 dist 的下界——`|len(a)-len(b)| > 0.38×maxLen` 直接跳过，砍掉绝大多数对。
  3. **大集合移 Web Worker**（>2000 文件时），保持 UI 可响应。
- 成本：0.5 天（1+2），Worker 0.5 天（U1 时按需）。

### P7 · journal 全量重写 + 无限增长

- 位置：`journal.ts:7-34`（每次 `appendOp` 读全量 JSON → push → 全量 pretty 重写）；`ipc.ts:69`（`journal:list` 全量过 IPC）。
- 问题：每次执行 O(整个 journal) 重写；journal 无上限增长，U1 备份中心要把整个历史过 IPC。
- 方案：改 **JSONL 追加**（`appendFile` 一行一 op，O(1)）；`journal:list` 返回摘要（时间/kind/数量/状态），明细按需拉取；配合备份中心做压缩合并（备份已清理的 op 可折叠）。
- 成本：0.5 天，与 U1 备份中心同 PR。

### P8 · 杂项（顺手修）

| 项 | 位置 | 修法 |
|---|---|---|
| `statFiles` 串行 stat | `files.ts:6-24` | 小并发池（8 路），万级目录扫描时有感 |
| `resolveMediaPaths` BFS 逐个 stat | `files.ts:29-50` | `readdir` 批量展开已在，改并发 stat；`maxFiles=5000` 触顶时给 UI 提示而非静默截断 |
| `InspectorPage` 复用 `probeFiles([p])` | `InspectorPage.tsx:23` | 命中 P1 缓存后自然受益，无需改 |
| `run()` stdout 上限 8MB | `ffmpeg.ts:78-80` | 已有保护，不动 |

## A2. 预估收益总表

| 链路 | 现状（500 文件） | 优化后 | 主要手段 |
|---|---|---|---|
| 首次探测 | 1-2.5 min | 15-40s | P1 并发 |
| 重复探测（执行后/重开） | 同首次 | <1s | P1 缓存 |
| 缩略图加载 | 20MB IPC + 500 次全列表重渲染 | 流畅、近零内存 | P2 协议 + P4 虚拟化 |
| 列表滚动（500 行） | 明显掉帧 | 60fps | P4 |
| 批量执行（20 个 1GB 文件） | ~80GB I/O、串行数分钟 | ~40GB、约一半墙钟 | P3 硬链接 + 并发 |
| 匹配（1000×1000） | 4-10s UI 冻结 | <0.5s | P6 桶 + 预筛 |

## A3. 落地顺序与 ROADMAP 映射

| 批次 | 内容 | 建议时机 |
|---|---|---|
| 第一批（v0.1.x，U0 前后） | P1（并发+缓存+渐进回填）、P2、P3-1 硬链接 | 立即——都是小改动大收益，且 U1 体检页直接依赖 P1/P2 的地基 |
| 第二批（U1 内） | P4 虚拟化、P5 归一化 store、P3-2 并发执行、P7 journal JSONL、P6-1/2 | 与 U1 各功能同 PR，避免二次返工 |
| 第三批（U1 后按需） | P6-3 Worker、P8 杂项 | 规模压力出现时 |

---

# B. UI 重构方案

## B1. 现状诊断

资产（b2eb980 重设计后已合格）：无边框窗口 + 自定义 chrome、antd5 深色主题 token（`theme.ts`）、SVG 图标体系、中英 i18n、`.ck-*` 样式体系（styles.css 516 行）。

结构性欠账（这次重构要解决的）：

1. **页面是"章鱼"**：SyncPage/TimeToolsPage 各自内联了选项组、进度条、执行逻辑、格式化工具；`formatSize/formatDuration` 甚至从 `FileListPanel.tsx` 导出给 Inspector 用（`InspectorPage.tsx:5`）——组件职责与归属混乱。
2. **单一 store 混三种状态**：`appStore` 同时装导航（activePage）、数据（三列表+pairs）、任务（busy/progress）。U1 要加会话持久化和 4 个新页面，这个形状撑不住。
3. **进度条在两个页面各画一份**（`SyncPage.tsx:251-256`、`TimeToolsPage.tsx:159-164`），U1 再加 4 份就是 6 份。
4. **设计 token 双轨**：antd token（theme.ts）与 9 处 TSX 内联 hex（`#5f6879` 等）、5 处 `marginTop:12` 内联散布，颜色语义没有单一来源。
5. **导航是平铺四项**：U1 后要 8 个页面，ROADMAP 已定"发现/修复/安全"三分组。
6. **无路由抽象**：`App.tsx:39-42` 条件链，页面无法懒加载。

## B2. 重构目标

为 U1（体检/表格/重命名/备份中心 + 会话保存）提供地基，而不是视觉改版。验收口径：**新增一个页面只需要写"页面壳 + 业务区块"，不碰 store 结构、不复制任何进度条/选项组/拖放/虚拟列表代码**。

## B3. 导航与信息架构

```
发现                 修复                  安全
├ 体检 (scan)        ├ 同步 (sync)         ├ 备份中心 (backups)
└ 检查器 (inspector) ├ 时间工具 (tools)     └ 历史 (history)
                     ├ 重命名 (rename)
                     └ 表格编辑 (table)
```

- `PageKey` 联合类型 + `pages/registry.tsx` 路由表（`Record<PageKey, LazyExoticComponent>`），`App.tsx` 只剩 `<Suspense><ActivePage/></Suspense>`；React.lazy 按页分包，8 页时启动仍然快。
- SideNav 支持分组标题（小节头 11px 大写字距样式），页脚保留 ffmpeg 状态点，追加版本号与 data 路径 tooltip。
- 不引入 react-router——桌面单窗口用 store 导航足够，少一个依赖。

## B4. 状态架构（重构的核心）

单 store 拆三个，职责与持久化边界对齐：

```
navStore    activePage                                   （不持久化）
mediaStore  items: Record<path, VideoItem>               （持久化 = U1 会话保存）
            lists: { sources/targets/tools/scan: path[] }
matchStore  pairs / threshold                            （持久化）
taskStore   busy / progress / cancel                      （不持久化）
```

要点：

- **归一化 items 是关键决策**：一份探测缓存、一份缩略图状态（P2 后连缩略图都不进 store）、同一文件跨页零重复（P5）。probe 结果只 `set` 单个 item，配 `useMediaItem(path)` 选择器——一行更新只重渲染一行。
- `lists` 只存路径数组，选择状态（selSources 等）可上移为 `selection: { [listKey]: Set<path> }`。
- 持久化用 zustand `partialize` 只落 mediaStore/lists + matchStore，天然就是 U1 的"会话保存"，不必到 U1 再改一次结构。
- taskStore 收敛全局唯一任务位（busy+progress+cancel token），消费方是一个 `useTask()` hook + 全局 TaskStatus 组件（见 B5）。

## B5. 组件体系（共享原语清单）

| 新组件/Hook | 取代 | 说明 |
|---|---|---|
| `MediaList`（虚拟滚动） | `FileListPanel` 列表体 | @tanstack/react-virtual；行组件 memo + `useMediaItem`；可选 checkbox 模式（表格/体检复用） |
| `TaskStatus` | 两个页面各自的 Progress 条 | 挂在 TitleBar 右侧或全局底栏，busy 时出现，含取消按钮（U1 可取消扫描的前提） |
| `OptionBar` | SyncPage/TimeToolsPage 重复的 metadata/mtime/ctime 三连 Checkbox | 绑定 core 的 WriteOptions 类型，值受控 |
| `useDropPaths()` | FileListPanel/InspectorPage 两份 onDrop 逻辑 | 返回 dragProps，内部走 resolvePaths |
| `format.ts` | 从 FileListPanel.tsx 导出的 formatSize/formatDuration | 纯函数归位，加 formatLocal 包装 |
| `PageShell` | 每页手写的 PageHeader+间距 | 统一 12px 栈间距（`.ck-stack` 工具类消灭 5 处 `marginTop:12` 内联） |
| `StatCard` | （新，体检页） | 三色统计卡，token 化颜色 |
| `DataTable` | SyncPage/InspectorPage 的 antd Table 裸配 | 统一 size/dark header/empty locale/virtual 开关 |

## B6. 设计系统收敛

- 单一来源 `tokens.ts`：导出 antd theme 配置（现 theme.ts 内容）**并**生成 `--ck-*` CSS 变量（注入 `:root`），新增 `colorHealth`（体检绿）语义位。
- 规则：**TSX 内禁止 hex 字面量**（lint 可查），颜色一律 `theme.useToken()` 或 `var(--ck-*)`；清理现存 9 处内联 hex。
- 时间戳统一 `font-variant-numeric: tabular-nums`（现在 3 处内联 style，收敛为一个 `.ck-time` 类）。
- 焦点环与键盘可达性：图标按钮（清除、窗口控制）补 aria-label；列表补方向键导航——体检/表格是重度键盘场景。

## B7. 实施顺序（每步独立可合入，均为行为保持型重构）

| 步 | 内容 | 工期 | 依赖 |
|---|---|---|---|
| R1 | tokens.ts + CSS 变量 + 清内联 hex / marginTop | 0.5 天 | 无 |
| R2 | store 拆分 + 归一化 mediaStore + useMediaItem | 1 天 | 无（配 store 单测） |
| R3 | 抽 OptionBar / useDropPaths / format.ts / TaskStatus | 1 天 | R2 |
| R4 | `ck-thumb://` 协议 + MediaList 虚拟化（= 性能 P2+P4） | 1.5 天 | R2 |
| R5 | 路由表 + lazy + SideNav 分组 | 0.5 天 | 无 |
| R6 | U1 四个新页面直接在原语上搭建 | — | R1-R5 |

R1/R5 可随时插入；**R2→R4 是关键路径**，做完后 U1 的重页面（体检扫描、表格编辑）才不会一上来就重写。合计约 4.5 天，建议排在 U0 之后、U1 之前作为"U1 前置周"。

> **状态（2026-09-30）**：R1-R5 已实现。B6"设计系统收敛"之外的**视觉与交互层**重构也已落地：表面阶梯（6 级）、文件行 88→64px、表格行压低、常驻底部操作栏（`.ck-actionbar`）、语义 chip 取代 antd 预设色 Tag、空状态全部可操作、检查器 kv 网格 + 流卡片、同步页 before→after 差异列（含方向箭头）。设计规则、布局契约与截图验证方式见 **`docs/UI-DESIGN.md`**，新页面以那份文档为准。

## B8. 风险与回归

- 行为保持型重构以现有 vitest（core 层）+ 新增 store/组件测试兜底；每步 `typecheck + test + dev 冒烟`（加文件→探测→预览→执行→撤销）后才合入下一步。
- `ck-thumb://` 协议需同步改 CSP（index.html `img-src`），打包模式（asar 外的 resources 路径）单独冒烟。
- 虚拟化对行高敏感：MediaList 行高固定为常量，缩略图加载前后不再跳高（骨架占位保持同尺寸）。
