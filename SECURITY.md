# Security Policy

## Scope

ChronoKit is a desktop application that runs **entirely locally**. It has no
network features, no account system, and no telemetry. Security-relevant areas
include:

- File writes (container metadata remux, filesystem timestamps, renaming) —
  correctness and reversibility matter.
- The bundled ffmpeg binaries fetched by `scripts/fetch-ffmpeg.mjs`
  (PATH copy or download of the BtbN LGPL build).
- The electron-builder packaging pipeline.

## Supported versions

| Version | Supported |
| --- | --- |
| 0.3.x | Yes |
| < 0.3.0 | No |

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Use GitHub's [private vulnerability reporting](https://github.com/lanyunyanaaa/chronokit/security/advisories/new)
to report the issue, including: affected version, a minimal reproduction
(file types and operations involved), and your assessment of the impact.

You can expect an initial response within 7 days. Fixes land in the next
patch release and are credited in the changelog (unless you prefer otherwise).
