'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'

interface RGBRangeFilterProps {
  value: string | undefined
  onChange: (value: string | undefined) => void
}

const THUMB_SIZE = 28
/** Как у кнопок «Габариты / Цена / Цвет»: py-1.5 sm:py-2 + text-xs sm:text-sm (~44px). */
const ROW_HEIGHT = 44

/**
 * Единая шкала 0–460:
 *   0– 25  Чёрный   (V: 0→0.20)
 *  25– 50  Серый    (V: 0.20→0.67)
 *  50– 75  Белый    (V: 0.67→1.0)
 *  75–100  Бежевый  (тёплые пастельные)
 * 100–460  Радуга   (Hue 0°→360°)
 */
const TOTAL = 460
const NEUTRAL_END = 100
const GRADIENT_STOPS = 64

function hueToRgb(h: number): { r: number; g: number; b: number } {
  const c = 1
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  let r1: number, g1: number, b1: number
  if (h < 60) { r1 = c; g1 = x; b1 = 0 }
  else if (h < 120) { r1 = x; g1 = c; b1 = 0 }
  else if (h < 180) { r1 = 0; g1 = c; b1 = x }
  else if (h < 240) { r1 = 0; g1 = x; b1 = c }
  else if (h < 300) { r1 = x; g1 = 0; b1 = c }
  else { r1 = c; g1 = 0; b1 = x }
  return {
    r: Math.round(r1 * 255),
    g: Math.round(g1 * 255),
    b: Math.round(b1 * 255),
  }
}

function scaleToColor(pos: number): { r: number; g: number; b: number } {
  if (pos < 25) {
    const v = Math.round((pos / 25) * 51)
    return { r: v, g: v, b: v }
  }
  if (pos < 50) {
    const v = Math.round(51 + ((pos - 25) / 25) * 119)
    return { r: v, g: v, b: v }
  }
  if (pos < 75) {
    const v = Math.round(170 + ((pos - 50) / 25) * 85)
    return { r: v, g: v, b: v }
  }
  if (pos < NEUTRAL_END) {
    const t = (pos - 75) / 25
    return {
      r: Math.round(255 - t * 45),
      g: Math.round(248 - t * 68),
      b: Math.round(240 - t * 100),
    }
  }
  const hue = ((pos - NEUTRAL_END) / (TOTAL - NEUTRAL_END)) * 360
  return hueToRgb(hue)
}

function colorToHex(c: { r: number; g: number; b: number }): string {
  return '#' + [c.r, c.g, c.b].map(v => v.toString(16).padStart(2, '0').toUpperCase()).join('')
}

function colorToRgbStr(c: { r: number; g: number; b: number }): string {
  return `rgb(${c.r},${c.g},${c.b})`
}

const clamp = (v: number) => Math.max(0, Math.min(TOTAL, Math.round(v)))

export default function RGBRangeFilter({ value, onChange }: RGBRangeFilterProps) {
  const [minVal, setMinVal] = useState(0)
  const [maxVal, setMaxVal] = useState(TOTAL)
  const activeThumbRef = useRef<'min' | 'max' | null>(null)
  const [pendingValue, setPendingValue] = useState<string | undefined>(undefined)
  const trackRef = useRef<HTMLDivElement>(null)

  const gradient = useMemo(() => {
    const stops: string[] = []
    for (let i = 0; i <= GRADIENT_STOPS; i++) {
      const pos = (i / GRADIENT_STOPS) * TOTAL
      const c = scaleToColor(pos)
      const pct = ((i / GRADIENT_STOPS) * 100).toFixed(2)
      stops.push(`${colorToRgbStr(c)} ${pct}%`)
    }
    return `linear-gradient(90deg, ${stops.join(', ')})`
  }, [])

  useEffect(() => {
    if (!value) {
      setMinVal(0)
      setMaxVal(TOTAL)
      return
    }
    const parts = value.trim().split('-')
    if (parts.length === 2) {
      const min = clamp(parseFloat(parts[0]) || 0)
      const max = clamp(parseFloat(parts[1]) || TOTAL)
      setMinVal(min)
      setMaxVal(max)
    }
  }, [value])

  const updateRange = (source: 'min' | 'max', rawValue: number) => {
    const clamped = clamp(rawValue)
    if (source === 'min') {
      const finalMin = Math.min(maxVal - 1, clamped)
      setMinVal(finalMin)
      setPendingValue(
        finalMin === 0 && maxVal === TOTAL ? undefined : `${finalMin}-${maxVal}`,
      )
    } else {
      const finalMax = Math.max(minVal + 1, clamped)
      setMaxVal(finalMax)
      setPendingValue(
        minVal === 0 && finalMax === TOTAL ? undefined : `${minVal}-${finalMax}`,
      )
    }
  }

  useEffect(() => {
    // Не дергаем родителя при монтировании (pendingValue ещё undefined) — лишний refetch каталога.
    if (pendingValue === undefined) return
    const id = window.setTimeout(() => {
      onChange(pendingValue)
    }, 250)
    return () => window.clearTimeout(id)
  }, [pendingValue, onChange])

  const valueFromX = (clientX: number): number => {
    const track = trackRef.current
    if (!track) return 0
    const rect = track.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return clamp(x * TOTAL)
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    const track = trackRef.current
    if (!track) return
    const rect = track.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const minX = minVal / TOTAL
    const maxX = maxVal / TOTAL
    const mid = (minX + maxX) / 2
    const thumb = x < mid ? 'min' : 'max'
    activeThumbRef.current = thumb
    updateRange(thumb, valueFromX(e.clientX))
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    const thumb = activeThumbRef.current
    if (!thumb) return
    updateRange(thumb, valueFromX(e.clientX))
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    activeThumbRef.current = null
    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
  }

  const minPercent = (minVal / TOTAL) * 100
  const maxPercent = (maxVal / TOTAL) * 100

  const minC = scaleToColor(minVal)
  const maxC = scaleToColor(maxVal)
  const minHex = colorToHex(minC)
  const maxHex = colorToHex(maxC)
  const minRgbStr = colorToRgbStr(minC)
  const maxRgbStr = colorToRgbStr(maxC)

  return (
    <div className='w-full'>
      <div className='mb-2 flex items-center justify-between gap-2 text-xs sm:text-sm font-medium text-gray-600'>
        <span className='shrink-0'>Диапазон цвета</span>
        <span className='flex items-center gap-1.5 text-[11px] sm:text-xs tabular-nums'>
          <span
            className='inline-block w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 rounded-full border border-gray-300'
            style={{ background: minRgbStr }}
          />
          <span>{minHex}</span>
          <span className='text-gray-400'>–</span>
          <span
            className='inline-block w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 rounded-full border border-gray-300'
            style={{ background: maxRgbStr }}
          />
          <span>{maxHex}</span>
        </span>
      </div>

      <div
        ref={trackRef}
        className='relative w-full shrink-0 select-none touch-none rounded-lg h-11 min-h-[44px] sm:min-h-[44px]'
        style={{ height: ROW_HEIGHT, minHeight: ROW_HEIGHT }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <div
          className='absolute inset-0 rounded-lg'
          style={{
            background: gradient,
          }}
        />

        <div
          className='absolute inset-y-0 rounded-lg pointer-events-none'
          style={{
            left: `${minPercent}%`,
            width: `${Math.max(maxPercent - minPercent, 0.5)}%`,
            boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.8)',
          }}
        />

        {minPercent > 0 && (
          <div
            className='absolute inset-y-0 rounded-l-lg pointer-events-none'
            style={{
              left: 0,
              width: `${minPercent}%`,
              background: 'rgba(0,0,0,0.45)',
            }}
          />
        )}
        {maxPercent < 100 && (
          <div
            className='absolute inset-y-0 rounded-r-lg pointer-events-none'
            style={{
              left: `${maxPercent}%`,
              width: `${100 - maxPercent}%`,
              background: 'rgba(0,0,0,0.45)',
            }}
          />
        )}

        <div
          className='absolute rounded-full border-[3px] border-white shadow-[0_2px_6px_rgba(0,0,0,0.3)] cursor-grab active:cursor-grabbing pointer-events-none'
          style={{
            width: THUMB_SIZE,
            height: THUMB_SIZE,
            left: `calc(${minPercent}% - ${THUMB_SIZE / 2}px)`,
            top: (ROW_HEIGHT - THUMB_SIZE) / 2,
            background: minRgbStr,
          }}
        />
        <div
          className='absolute rounded-full border-[3px] border-white shadow-[0_2px_6px_rgba(0,0,0,0.3)] cursor-grab active:cursor-grabbing pointer-events-none'
          style={{
            width: THUMB_SIZE,
            height: THUMB_SIZE,
            left: `calc(${maxPercent}% - ${THUMB_SIZE / 2}px)`,
            top: (ROW_HEIGHT - THUMB_SIZE) / 2,
            background: maxRgbStr,
          }}
        />
      </div>
    </div>
  )
}
