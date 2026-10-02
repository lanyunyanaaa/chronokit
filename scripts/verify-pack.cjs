/**
 * electron-builder beforePack hook: refuse to package without the ffmpeg
 * binaries in place. Run scripts/fetch-ffmpeg.mjs first (the dist scripts
 * chain it automatically).
 */
const { existsSync } = require('fs')
const { join } = require('path')

module.exports = async function verifyFfmpeg(context) {
  const dir = join(context.packager.projectDir, 'resources', 'ffmpeg')
  for (const exe of ['ffmpeg.exe', 'ffprobe.exe']) {
    if (!existsSync(join(dir, exe))) {
      throw new Error(
        `resources/ffmpeg/${exe} missing — run "node scripts/fetch-ffmpeg.mjs" before packaging`
      )
    }
  }
}
