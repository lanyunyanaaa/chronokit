# ChronoKit 设计系统与布局契约

> 2026-10-01 · **v4 白昼主题（light modern）**：应用整体翻转为白色现代 UI（灰画布 + 白卡片 + 蓝主色），规则与本文一致，仅表面语义反转（见 §2/§8）· 配套代码：`src/renderer/src/tokens.ts`、`styles.css`、`components/`
>
> 前一份 `PERF-AND-UI-REFACTOR.md` 解决的是"结构"（归一化 store、原语、虚拟化）；本文记录**视觉与交互层**的规则：表面阶梯、密度、布局契约、组件清单。U1 的四个新页面（体检/表格/重命名/备份中心）请直接按本文的规则搭建。

---

## 1. 五条设计原则

1. **层级靠表面与阴影，不靠重边框**：白昼界面里"白卡片浮在灰画布上"，配 1px 最柔边框 + 轻阴影。6 级表面（bg → surface → card → raised → hover → high）读得出深度顺序：浮层（high）与卡片（card）是白的，控件（raised）是灰的——与暗色主题相反，高度朝白色变亮。
2. **密度优先**：这是工作台不是展示页。文件行 88px → **64px 节距**，表格行 ~66px → **~48px**，面板头 46px 固定。同屏信息量翻倍。
3. **一屏一主动作**：每个"操作页"底部的 `${.ck-actionbar}` 常驻，写入内容 + 预览/执行永不出屏。页面本身可以滚动，动作栏不会跑掉。
4. **空状态必须可操作**：空面板不复述"没有东西"，而是给出下一步按钮（添加文件 / 添加文件夹 / 选择文件）。
5. **单一色彩来源**：所有颜色/间距/字号都从 `tokens.ts` 出发，TSX 与 CSS 都不允许出现 hex（`styles.css` 用 `var(--ck-*)`，半透明用 `rgba(var(--ck-*-rgb), a)`）。

---

## 2. Token 层（`tokens.ts`）

```
palette   颜色（表面阶梯 / 文字 4 级 / 品牌 / 语义 / 杂项）
space     4px 基准间距，space[1..7] = 4..24
radius    sm6 md8 lg12 xl16 pill
fontSize  xs10.5 sm11.5 md12.5 base13.5 lg15 hd19
shadow    sm/md/lg/accent
layout    titlebarH 42 · sidenavW 212 · rowH 64 · toolH 32
```

- `lightTheme`（antd ThemeConfig，`defaultAlgorithm`）与 `injectCkTokens()`（`:root` 上的 `--ck-*`）都由上面的对象派生，**改一处两边同步**。新增的 antd 组件 token 覆盖集中在 `lightTheme.components`（Table/Select/Segmented/Modal/Dropdown/Collapse…），页面里不要再写 `style={{ color: '#xxx' }}`。
- 半透明填充统一用 `--ck-*-rgb` 三元组，例如 `rgba(var(--ck-accent-rgb), 0.14)`。
- 等宽数字/时间用 `--ck-font-mono` + `.ck-time` / `.ck-mono`（Cascadia Mono → Consolas 回退）。

### 表面阶梯与语义色用法

| 变量 | 用途 |
|---|---|
| `--ck-bg` | 应用画布（含两处极淡的径向色晕） |
| `--ck-surface` | 侧栏、标题栏、面板内嵌区（subbar/模态页脚） |
| `--ck-card` | 面板（`.ck-panel`）、kv 网格、模态、输入框——白 |
| `--ck-raised` | 可交互块：文件行、默认按钮、Segmented 轨道——浅灰 |
| `--ck-hover` / `--ck-high` | 悬停态 / 下拉菜单与浮层（白 + 阴影） |

语义 chip：`ck-chip-blue`(元数据时间) · `ck-chip-purple`(文件名时间) · `ck-chip-green`(同名匹配/已执行) · `ck-chip-warn`(大小匹配/警告) · `ck-chip-red`(错误) · `ck-chip-neutral`(来源/标签) · `ck-chip-dash`(缺失值，虚线边)。**不再使用 antd 预设色 `<Tag color="processing">`**，避免与 token 体系脱钩。v3 起彩色 chip 一律**无边框**，白昼主题下靠淡底色 + 深色文字变体（blue .11 / purple .10 / green .11 / warn .12 / red .10 / neutral .06）；只有 `ck-chip-dash` 保留虚线边（缺失语义）。

### v4.1 精修补充（2026-10-25 · v0.3.0）

- **操作栏摘要 pill**：`.ck-bar-summary`——底部操作栏的状态摘要（可预览 N 对 / 可修复 N 类 / 作用域提示）从灰色 `ck-hint` 升格为带边 pill，数字 tabular；就绪态加 `is-positive`（淡绿底）。摘要永远在主按钮左侧，形成"状态 → 动作"配对。
- **体检卡严重度锚点**：`.ck-issue.is-error/.is-warn/.is-info` 左缘 2.5px 内嵌色条（与文件选中"播放头"同隐喻）；`.ck-sev-dot` 用 `--ck-red/--ck-amber`（注意：语义色变量名是 red/amber/green，不存在 `--ck-danger/--ck-warning`）。
- **Segmented 选中项浮起**：选中 thumb 加 `sh-sm` 阴影 + 600 字重，保证"当前模式"的层级强于行级选中态。
- **时间码 mono 全覆盖**：批量表格单元格 `.ck-cell-time` 也走 `--ck-font-mono`；PlanModal 字段标签用 ck-chip（禁 antd Tag 预设色）。
- 空态入口按钮 `.ck-empty-actions .ant-btn` 统一 min-width 108px。

---

## 3. 布局契约（DOM 与 CSS 分工）

```
.ck-shell            固定视口列：titlebar / body / 全局任务药丸
  .ck-titlebar       42px，品牌 + 副标题 + 版本 + 窗口按钮
  .ck-body
    .ck-sidenav      212px，分组导航 + 底部 FFmpeg 状态卡
    .ck-main         唯一的页面滚动容器，暴露 --ck-pad-x，display:flex column
      .ck-page       flex:1 0 auto（内容高则页面变高、外层滚动）
      .ck-page--fill flex:1 1 0（页面恰好一屏，内部列表滚动）——列表工作台页用
        .ck-panel / .ck-panel--fill     后者吸收剩余高度（min-height:200px）
        .ck-actionbar                   sticky bottom:0 + margin-top:auto，永远贴窗口底边
  .ck-taskpill       固定右下角，busy 时出现（probe/exec 进度）
```

- **面板三件套**：`.ck-panel` > `.ck-panel-head`（46px，标题 + 计数 chip + 右侧动作）+ `.ck-panel-subbar`（可选配置条）+ `.ck-panel-body`（`--flush` 给列表、`--tight` 给表格）。
- 页面级圆角栈：面板 12px、行/输入 8px、chip 6px。
- 动效只用于 hover/出现（120–180ms），并受 `prefers-reduced-motion` 保护。

**判定规则**：页面内容以"列表"为中心 → `ck-page--fill` + 面板 `--fill` + `MediaList fill`（时间工具、操作历史、U1 的表格页）；页面内容以"多个并列区块"为中心 → 默认 `ck-page`，区块有界高度（同步时间）。

---

## 4. 组件原语清单

| 组件 | 契约 |
|---|---|
| `PageShell` | `title / badge / desc / actions / footer / pageProps`。`footer` 渲染为 `.ck-actionbar`；`pageProps` 可挂拖拽事件与状态类 |
| `FileListPanel` | 媒体列表面板：头部（标题+计数+已选 chip+全选/移除/清空/添加 split 按钮）、`toolbar` 槽（模式条）、`fill` 模式、拖拽导入、可操作空状态 |
| `MediaList` | 虚拟滚动行（`layout.rowH` 节距）；**选择模型**：单击=只选它 / Ctrl(⌘)=切换 / Shift=区间；行内悬停出现"移除"；`fill` 时自适应父高 |
| `EmptyState` | `icon / title / hint / actions / dropActive`；`actions` 是空状态能被"用起来"的关键 |
| `OptionBar` | 写入目标三连 toggle chip（元数据时间 / 修改时间 / 创建时间 NTFS），tooltip 给完整解释 |
| `TaskStatus` | 全局任务药丸（转圈 + 进度条 + done/total） |
| `Thumb` | 缩略图瓦片（16:9），IntersectionObserver 懒加载 `ck-thumb://`，占位与失败都有图标态 |
| `TimeBadges` | 行内两枚时间 chip（元数据蓝 / 文件名紫），带小图标区分，缺失时虚线 chip |
| `icons.tsx` | 自绘 stroke 图标集（1.7px / 24 网格 / currentColor）：导航、箭头、标签、时钟、盾牌等。**界面与文档一律不用 emoji** |

---

## 5. 交互约定

- **拖拽**：`useDropPaths()` 一处实现，文件列表面板与检查器共用；拖入时 `ck-drop-active` 画虚线环。
- **危险动作**：移除单行用悬停图标（即时、不可逆但有历史兜底）；撤销走 Popconfirm。
- **写操作永远先 dry-run**：底部操作栏 → `PlanModal`（before → after 差异 + 来源 + 安全提示）→ 执行；按钮文字与命令式反馈都走 i18n。
- **状态可见性**：任何耗时任务都会由全局药丸接管进度，页面内不再各写进度条。
- i18n：所有文案键必须中英同步（`common / opt / sync / plan / tools / inspector / history / exec` 命名空间），新增键后跑一次键位对齐校验（见下）。

---

## 6. 验证方式

```bash
pnpm typecheck                 # 双 tsconfig 全绿
pnpm test                      # 49 个单测（core + store）
CK_SHOT=1 pnpm dev             # 自动截图到 .data/shots/ 后退出
```

`CK_SHOT=1` 会依次产出 9 张图，覆盖空态与载入态两条路径：

| 文件 | 内容 |
|---|---|
| `empty-{sync,tools,inspector,history}.png` | 冷启动空状态（可操作空态、禁用态按钮） |
| `sync.png` | 配对表格 + 双向选择（源/目标各选 1）+ 底部操作栏 |
| `tools.png` | 批量编辑工作台（模式条 + 选中 1 个文件的作用域提示） |
| `inspector.png` | 元数据 kv 网格 + 流卡片 + 标签表 |
| `plan-modal.png` | dry-run 预览弹窗（差异行 + 摘要 chip + 安全提示） |
| `history.png` | 真实执行后的日志记录（脚本末尾会自动撤销，保持夹具干净） |

截图脚本会等「导航高亮 == 目标页 && 页面标题已渲染」再抓帧（`capturePage()` 过早会返回上一帧），并关闭后台节流。

---

## 7. 已知未做（后续候选）

- 同步页 / 检查器的**右侧详情面板**（PROMPT 里的"源/目标对比"，需要按选中项按需 probe 全量 MediaInfo）。
- 列表排序/筛选、键盘方向键导航与快捷键（Ctrl+1..4 切页）。
- 体检中心、批量表格、重命名、备份中心（U1）——按本文规则直接在原语上搭建即可。

---

## 8. v4 白昼主题（2026-10-01 · "白纸上的精密时码仪器"）

应用从暗色整体翻转为**白色现代 UI**，结构契约（§3-§5）不变。主题翻转全部由 `tokens.ts` 单一来源派生（antd `defaultAlgorithm` + `--ck-*` 变量），换主题不留死角；主进程窗口底色 `backgroundColor: '#f2f4f8'` 同步。四条视觉规则：

1. **渐变预算 = 1**：品牌渐变（accent → accent2）只允许出现在 `.ck-logo` 一处。主按钮为纯 accent 平色（hover 用 `color-mix` 提亮），画布径向色晕降到 0.05/0.04 的"耳语"级；标题栏/侧栏/操作栏的半透明渐变是功能性蒙层，不算装饰。
2. **时间码用 mono 声音**：所有时间戳（`.ck-time`、文件行时间 chip、kv 值、表格时间列）统一 `--ck-font-mono` + tabular 数字——时间数据是这个应用的主体，让它有自己的声音；表格时间单元格加 `ck-nowrap` 防换行。
3. **白卡片 + 柔阴影分层**：灰画布 `#f2f4f8`，白卡片 + `sh-sm` 轻阴影 + `borderSoft` 发丝边；面板头有 0.016 的中性提亮。选中态 = 淡蓝底 + 左缘 2.5px accent "播放头"内嵌条（时间轴隐喻），导航 active 标记同一步调。
4. **工具条/输入框语义**：默认按钮与 Segmented 轨道用浅灰 `raised`（选中项是白 pill），输入框在白面板上保持白色、靠发丝边区分；Tooltip 保持深底（`tooltipBg` + `tooltipText`），是白昼界面里唯一的"反转色"。

设计参照 frontend-design skill（anthropics/skills，装于工作区 `.zcode/skills/frontend-design/`）：视觉个性从题材（时间/时码/前后差异）来，装饰收敛、数据说话。
