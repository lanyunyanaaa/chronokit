import { copyFile, mkdir } from 'fs/promises'
import path from 'path'
import { backupDir } from './paths'

/** Copy a file into the central backup dir; returns the backup path. */
export async function backupFile(file: string): Promise<string> {
  await mkdir(backupDir(), { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const rand = Math.random().toString(36).slice(2, 6)
  const dest = path.join(backupDir(), `${stamp}_${rand}_${path.basename(file)}`)
  await copyFile(file, dest)
  return dest
}
