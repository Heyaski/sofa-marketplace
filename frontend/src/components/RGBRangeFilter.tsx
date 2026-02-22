'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'

interface RGBRangeFilterProps {
  value: string | undefined
  onChange: (value: string | undefined) => void
}

const THUMB_SIZE = 18
const TRACK_HEIGHT = 16
const MAX_HUE = 360
const GRADIENT_STOPS = 36

function hueToRgb(h: number): { r: number; g: number; b: number } {
  const c = 1
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = 0
  let r1: number, g1: number, b1: number
  if (h < 60) { r1 = c; g1 = x; b1 = 0 }
  else if (h < 120) { r1 = x; g1 = c; b1 = 0 }
  else if (h < 180) { r1 = 0; g1 = c; b1 = x }
  else if (h < 240) { r1 = 0; g1 = x; b1 = c }
  else if (h < 300) { r1 = x; g1 = 0; b1 = c }
  else { r1 = c; g1 = 0; b1 = x }
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  }
}

function hueToRgbString(h: number): string {
  const { r, g, b } = hueToRgb(h)
  return `rgb(${r},${g},${b})`
}

function hueToHex(h: number): string {
  const { r, g, b } = hueToRgb(h)
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0').toUpperCase()).join('')
}

const clampHue = (v: number) => Math.max(0, Math.min(MAX_HUE, Math.round(v)))

export default function RGBRangeFilter({ value, onChange }: RGBRangeFilterProps) {
  const [minVal, setMinVal] = useState(0)
  const [maxVal, setMaxVal] = useState(MAX_HUE)
  const activeThumbRef = useRef<'min' | 'max' | null>(null)
  const [pendingValue, setPendingValue] = useState<string | undefined>(undefined)
  const trackRef = useRef<HTMLDivElement>(null)

  const gradient = useMemo(() => {
    const stops: string[] = []
    for (let i = 0; i <= GRADIENT_STOPS; i++) {
      const hue = (i / GRADIENT_STOPS) * MAX_HUE
      const pct = ((i / GRADIENT_STOPS) * 100).toFixed(2)
      stops.push(`${hueToRgbString(hue)} ${pct}%`)
    }
    return `linear-gradient(90deg, ${stops.join(', ')})`
  }, [])

  useEffect(() => {
    if (!value) {
      setMinVal(0)
      setMaxVal(MAX_HUE)
      return
    }
    const parts = value.trim().split('-')
    if (parts.length === 2) {
      const min = clampHue(parseFloat(parts[0]) || 0)
      const max = clampHue(parseFloat(parts[1]) || MAX_HUE)
      setMinVal(min)
      setMaxVal(max)
    }
  }, [value])

  const updateRange = (source: 'min' | 'max', rawValue: number) => {
    const clamped = clampHue(rawValue)
    if (source === 'min') {
      const finalMin = Math.min(maxVal - 1, clamped)
      setMinVal(finalMin)
      setPendingValue(
        finalMin === 0 && maxVal === MAX_HUE ? undefined : `${finalMin}-${maxVal}`,
      )
    } else {
      const finalMax = Math.max(minVal + 1, clamped)
      setMaxVal(finalMax)
      setPendingValue(
        minVal === 0 && finalMax === MAX_HUE ? undefined : `${minVal}-${finalMax}`,
      )
    }
  }

  useEffect(() => {
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
    return clampHue(x * MAX_HUE)
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    const track = trackRef.current
    if (!track) return
    const rect = track.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const minX = minVal / MAX_HUE
    const maxX = maxVal / MAX_HUE
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

  const minPercent = (minVal / MAX_HUE) * 100
  const maxPercent = (maxVal / MAX_HUE) * 100

  const minColor = hueToRgbString(minVal)
  const maxColor = hueToRgbString(maxVal)
  const minRgb = hueToRgb(minVal)
  const maxRgb = hueToRgb(maxVal)
  const minHex = hueToHex(minVal)
  const maxHex = hueToHex(maxVal)

  return (
    <div className='w-full py-3'>
      <div className='mb-1 flex justify-between text-[11px] text-gray-500'>
        <span>Диапазон цвета</span>
        <span className='flex items-center gap-1.5'>
          <span
            className='inline-block w-3 h-3 rounded-full border border-gray-300'
            style={{ background: minColor }}
          />
          <span>{minHex}</span>
          <span className='text-gray-400'>–</span>
          <span
            className='inline-block w-3 h-3 rounded-full border border-gray-300'
            style={{ background: maxColor }}
          />
          <span>{maxHex}</span>
        </span>
      </div>

      <div
        ref={trackRef}
        className='relative select-none touch-none'
        style={{ height: 44, minHeight: 44 }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {/* Радужная полоса: полный спектр HSL Hue 0°–360° */}
        <div
          className='absolute rounded-full'
          style={{
            left: 0,
            right: 0,
            top: (44 - TRACK_HEIGHT) / 2,
            height: TRACK_HEIGHT,
            background: gradient,
          }}
        />

        {/* Подсветка выбранного диапазона */}
        <div
          className='absolute rounded-full pointer-events-none'
          style={{
            left: `${minPercent}%`,
            width: `${Math.max(maxPercent - minPercent, 0.5)}%`,
            top: (44 - TRACK_HEIGHT) / 2,
            height: TRACK_HEIGHT,
            boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.8)',
          }}
        />

        {/* Затемнение вне диапазона — слева */}
        {minPercent > 0 && (
          <div
            className='absolute rounded-l-full pointer-events-none'
            style={{
              left: 0,
              width: `${minPercent}%`,
              top: (44 - TRACK_HEIGHT) / 2,
              height: TRACK_HEIGHT,
              background: 'rgba(0,0,0,0.45)',
            }}
          />
        )}
        {/* Затемнение вне диапазона — справа */}
        {maxPercent < 100 && (
          <div
            className='absolute rounded-r-full pointer-events-none'
            style={{
              left: `${maxPercent}%`,
              width: `${100 - maxPercent}%`,
              top: (44 - TRACK_HEIGHT) / 2,
              height: TRACK_HEIGHT,
              background: 'rgba(0,0,0,0.45)',
            }}
          />
        )}

        {/* Левый ползунок */}
        <div
          className='absolute rounded-full border-[3px] border-white shadow-[0_2px_6px_rgba(0,0,0,0.3)] cursor-grab active:cursor-grabbing pointer-events-none'
          style={{
            width: THUMB_SIZE,
            height: THUMB_SIZE,
            left: `calc(${minPercent}% - ${THUMB_SIZE / 2}px)`,
            top: (44 - THUMB_SIZE) / 2,
            background: minColor,
          }}
        />
        {/* Правый ползунок */}
        <div
          className='absolute rounded-full border-[3px] border-white shadow-[0_2px_6px_rgba(0,0,0,0.3)] cursor-grab active:cursor-grabbing pointer-events-none'
          style={{
            width: THUMB_SIZE,
            height: THUMB_SIZE,
            left: `calc(${maxPercent}% - ${THUMB_SIZE / 2}px)`,
            top: (44 - THUMB_SIZE) / 2,
            background: maxColor,
          }}
        />
      </div>
    </div>
  )
}
