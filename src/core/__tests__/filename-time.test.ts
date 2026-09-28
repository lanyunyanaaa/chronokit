import { describe, expect, it } from 'vitest'
import { parseTimeFromFilename } from '../filename-time'

const local = (y: number, mo: number, d: number, h: number, mi: number, s: number) =>
  new Date(y, mo - 1, d, h, mi, s).getTime()

describe('parseTimeFromFilename', () => {
  it('parses Android VID_ names', () => {
    const r = parseTimeFromFilename('D:\\cam\\VID_20230101_120305.mp4')
    expect(r).not.toBeNull()
    expect(r!.date.getTime()).toBe(local(2023, 1, 1, 12, 3, 5))
    expect(r!.patternId).toBe('prefixed-ymd-his')
  })

  it('parses IMG_ names and ignores burst suffixes', () => {
    const r = parseTimeFromFilename('IMG_20190228_235959_BURST003.jpg')
    expect(r!.date.getTime()).toBe(local(2019, 2, 28, 23, 59, 59))
  })

  it('parses Pixel PXL_ names with millisecond tail', () => {
    const r = parseTimeFromFilename('PXL_20230101_120305123.MP4')
    expect(r!.date.getTime()).toBe(local(2023, 1, 1, 12, 3, 5))
  })

  it('parses WeChat mmexport epoch-ms names', () => {
    const r = parseTimeFromFilename('mmexport1672531200000.mp4')
    expect(r!.date.toISOString()).toBe('2023-01-01T00:00:00.000Z')
  })

  it('parses WeChat WX screenshot names', () => {
    const r = parseTimeFromFilename('WX20230101-120305.jpg')
    expect(r!.date.getTime()).toBe(local(2023, 1, 1, 12, 3, 5))
  })

  it('parses Android dashed screenshots', () => {
    const r = parseTimeFromFilename('Screenshot_2023-01-01-12-03-05.png')
    expect(r!.date.getTime()).toBe(local(2023, 1, 1, 12, 3, 5))
  })

  it('parses compact screenshots', () => {
    const r = parseTimeFromFilename('Screenshot_20230101-120305.png')
    expect(r!.date.getTime()).toBe(local(2023, 1, 1, 12, 3, 5))
  })

  it('parses iOS US-style screen recordings', () => {
    const r = parseTimeFromFilename('ScreenRecording_01-01-2023 12-03-05.MP4')
    expect(r!.date.getTime()).toBe(local(2023, 1, 1, 12, 3, 5))
  })

  it('parses modern iOS screen recordings', () => {
    const r = parseTimeFromFilename('Screen Recording 2023-01-01 at 12.03.05.MP4')
    expect(r!.date.getTime()).toBe(local(2023, 1, 1, 12, 3, 5))
  })

  it('parses WhatsApp videos', () => {
    const r = parseTimeFromFilename('WhatsApp Video 2023-01-01 at 12.03.05.mp4')
    expect(r!.date.getTime()).toBe(local(2023, 1, 1, 12, 3, 5))
  })

  it('parses generic compact timestamps', () => {
    const r = parseTimeFromFilename('20230101_120305.mp4')
    expect(r!.date.getTime()).toBe(local(2023, 1, 1, 12, 3, 5))
  })

  it('parses generic dashed timestamps', () => {
    const r = parseTimeFromFilename('2023-01-01 12.03.05.mp4')
    expect(r!.date.getTime()).toBe(local(2023, 1, 1, 12, 3, 5))
  })

  it('rejects names without timestamps', () => {
    expect(parseTimeFromFilename('DJI_0001.MP4')).toBeNull()
    expect(parseTimeFromFilename('holiday_video.mp4')).toBeNull()
    expect(parseTimeFromFilename('GX010123.MP4')).toBeNull()
  })

  it('rejects implausible dates', () => {
    expect(parseTimeFromFilename('IMG_20990101_120305.mp4')).toBeNull()
    expect(parseTimeFromFilename('IMG_20231301_120305.mp4')).toBeNull()
  })

  it('anchors at basename start, not mid-path', () => {
    expect(parseTimeFromFilename('C:\\20230101_120305\\holiday.mp4')).toBeNull()
  })
})
