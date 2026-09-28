import { describe, expect, it } from 'vitest'
import {
  formatLocal,
  isPlausibleDate,
  parseFfprobeDate,
  pickSourceTime,
  shiftDate,
  toFfprobeCreationTime
} from '../time-engine'

describe('parseFfprobeDate', () => {
  it('parses ffmpeg 6-digit fractional UTC dates', () => {
    expect(parseFfprobeDate('2023-01-01T12:00:00.000000Z')!.getTime()).toBe(Date.UTC(2023, 0, 1, 12))
  })

  it('parses explicit timezone offsets', () => {
    expect(parseFfprobeDate('2023-01-01T12:00:00+08:00')!.getTime()).toBe(Date.UTC(2023, 0, 1, 4))
  })

  it('treats naive values as UTC (ffmpeg convention)', () => {
    expect(parseFfprobeDate('2023-01-01 12:00:00')!.getTime()).toBe(Date.UTC(2023, 0, 1, 12))
  })

  it('returns null for garbage', () => {
    expect(parseFfprobeDate(null)).toBeNull()
    expect(parseFfprobeDate('')).toBeNull()
    expect(parseFfprobeDate('garbage')).toBeNull()
  })
})

describe('toFfprobeCreationTime', () => {
  it('formats as ffmpeg creation_time', () => {
    expect(toFfprobeCreationTime(new Date(Date.UTC(2023, 0, 1, 4, 5, 6)))).toBe(
      '2023-01-01T04:05:06.000000Z'
    )
  })

  it('round-trips through parseFfprobeDate', () => {
    const d = new Date(Date.UTC(2024, 5, 15, 8, 30, 59))
    expect(parseFfprobeDate(toFfprobeCreationTime(d))!.getTime()).toBe(d.getTime())
  })
})

describe('shiftDate', () => {
  it('shifts by hours/minutes', () => {
    expect(shiftDate(new Date(0), { hours: 8 }).getTime()).toBe(8 * 3600_000)
    expect(shiftDate(new Date(0), { hours: -1, minutes: -30 }).getTime()).toBe(-5400_000)
    expect(shiftDate(new Date(0), { days: 1 }).getTime()).toBe(86_400_000)
  })
})

describe('pickSourceTime', () => {
  const meta = new Date(Date.UTC(2023, 0, 1))
  const fname = new Date(Date.UTC(2022, 0, 1))
  const fs = new Date(Date.UTC(2021, 0, 1))

  it('prefers metadata > filename > filesystem', () => {
    expect(pickSourceTime({ metadataTime: meta, filenameTime: fname, fsTime: fs })!.source).toBe('metadata')
    expect(pickSourceTime({ filenameTime: fname, fsTime: fs })!.source).toBe('filename')
    expect(pickSourceTime({ fsTime: fs })!.source).toBe('filesystem')
  })

  it('skips implausible values like epoch 0', () => {
    expect(pickSourceTime({ metadataTime: new Date(0), fsTime: fs })!.source).toBe('filesystem')
  })

  it('returns null when nothing is usable', () => {
    expect(pickSourceTime({ fsTime: new Date(0) })).toBeNull()
    expect(pickSourceTime({})).toBeNull()
  })
})

describe('formatLocal', () => {
  it('formats local components', () => {
    expect(formatLocal(new Date(2023, 0, 1, 9, 5, 3))).toBe('2023-01-01 09:05:03')
  })
})

describe('isPlausibleDate', () => {
  it('bounds the sane window', () => {
    expect(isPlausibleDate(new Date(Date.UTC(1980, 0, 1)))).toBe(false)
    expect(isPlausibleDate(new Date(Date.UTC(2020, 0, 1)))).toBe(true)
    expect(isPlausibleDate(new Date(Date.now() + 30 * 86_400_000))).toBe(false)
  })
})
