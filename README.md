# ChronoKit

**Open-source video timestamps & metadata toolbox · 开源的视频时间与元数据工作台**

ChronoKit helps you inspect, fix, sync and batch-edit the *times* of your videos —
container metadata `creation_time`, filesystem modified time and even NTFS creation
time — with a dry-run preview, central backups and cross-session undo.

> 100% local. No accounts, no telemetry. Built with Electron + React + Ant Design.

## Features (v0.1)

- **Sync times** — pair "source" videos (correct times) with "target" videos
  (re-encoded / re-downloaded copies) and copy the real times over.
  - Smart matching: exact name → fuzzy name → size → duration; manual rebinding
    in a two-pane table.
  - Time source priority chain: metadata `creation_time` → filename timestamp
    (`VID_20230101_120305.mp4`, `IMG_…`, `PXL_…`, `Screenshot_…`, `WX…`,
    `mmexport…`, DJI, iOS/WhatsApp screen recordings and more) → filesystem time.
  - Writes: metadata `creation_time` (lossless stream-copy remux), mtime,
    NTFS creation time (Windows).
- **Time tools** — set an absolute time, batch-shift (+8h timezone fixes), or
  apply timestamps parsed from filenames.
- **Inspector** — full ffprobe view of streams, tags and container info,
  exportable as JSON.
- **History** — every write is journaled; undo restores files from central
  backups even after restarting the app.

## Development

```bash
pnpm install
pnpm dev        # run the app
pnpm test       # vitest unit tests (core logic)
pnpm build      # compile bundles
pnpm dist       # package Windows installer + portable exe (electron-builder)
```

FFmpeg/ffprobe are resolved from (in order): the `CK_FFMPEG_DIR` env var, the
bundled `resources/ffmpeg` folder, then the system PATH.

## License

[MIT](./LICENSE)
