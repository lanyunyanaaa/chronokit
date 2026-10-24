# Changelog

All notable changes to ChronoKit are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/).

## [0.3.0] — 2026-10-25

First public release.

### Added
- **Photo support (read-only EXIF)** — JPEG and PNG join the pipeline:
  `DateTimeOriginal` (+ `OffsetTimeOriginal`) is parsed from APP1 / eXIf chunks
  with a hand-rolled TIFF IFD walk, normalized to UTC. Photos are guarded at
  plan level: container metadata is never rewritten for photos, only
  filesystem mtime/ctime.
- **UI polish (design system v4.1)** — severity accents on checkup issues,
  footer summary pills across all pages, segmented-control selection shadows,
  chip styling in plan modals.

### Fixed
- Severity dots were invisible due to broken CSS custom-property references.
- Left-edge severity bars missing on issue cards.

## [0.2.0] — 2026-10-02

The daily-use loop.

### Added
- **Checkup Center** — rule engine (R1–R7) scans the library for time problems,
  reports them, and fixes them one click (reuses the plan → dry-run → exec → undo pipeline).
- **Batch Table** — virtualized spreadsheet editing: set target-column values,
  apply offsets, copy between columns; edit state survives restarts.
- **Smart Rename** — timestamp-based renaming with three templates and conflict
  strategies; rename operations are journaled and undoable.
- **Backup Center** — per-operation backup grouping, single-file restore,
  deletion guards, 30-day retention cleanup.
- **Session memory** — lists, tabs, thresholds and table edit state are restored
  on launch; window position is remembered.

## [0.1.1] — 2026-10-02

The usable baseline.

### Added
- Application icon (SVG → ICO/PNG pipeline with Electron canvas rasterizer).
- Bundled ffmpeg landing: `pnpm ffmpeg:fetch` (PATH copy or LGPL build download)
  plus a `beforePack` verification hook; installer and portable packaging via
  electron-builder (NSIS + portable), with usage documentation.

## [0.1.0] — 2026-09-29

Initial internal release.

### Added
- Core app: **Sync Time** (source → target with smart matching), **Time Tools**
  (absolute set, batch offset, filename time parsing), **Inspector**,
  **Operation History** with persistent journal and undo.
- Safety model: dry-run preview before every write, centralized backups.
- Full visual redesign: frameless window, custom chrome, light design system;
  all emoji replaced with inline SVG icons; English & 简体中文 UI.
- Smart import (recursive scan, original/copy pairing), shell thumbnails,
  store split, UI design system documentation.

[0.3.0]: https://github.com/lanyunyanaaa/chronokit/releases/tag/v0.3.0
[0.2.0]: https://github.com/lanyunyanaaa/chronokit/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/lanyunyanaaa/chronokit/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/lanyunyanaaa/chronokit/releases/tag/v0.1.0
