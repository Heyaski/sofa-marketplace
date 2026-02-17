'use client'

import React, { useEffect, useRef, useState } from 'react'

interface RGBRangeFilterProps {
	value: string | undefined // формат "min-max" (0–255) или старый "r,g,b"
	onChange: (value: string | undefined) => void
}

// Подсчёт яркости по RGB (простой средний)
const getBrightness = (rgb: string): number | null => {
	const parts = rgb.split(',').map(p => parseInt(p.trim(), 10))
	if (parts.length !== 3 || parts.some(p => Number.isNaN(p))) {
		return null
	}
	const [r, g, b] = parts.map(v => Math.min(255, Math.max(0, v)))
	return Math.round((r + g + b) / 3)
}

const THUMB_SIZE = 18
const TRACK_HEIGHT = 8
// Градиент: чёрный (0) → радуга → белый (255) — соответствует яркости из Excel (r+g+b)/3
const RAINBOW_GRADIENT =
	'linear-gradient(90deg, #000000 0%, #1a0a0a 2%, #ff0000 8%, #ff7f00 25%, #ffff00 42%, #00ff00 58%, #00ffff 75%, #0000ff 90%, #f5f5f5 98%, #ffffff 100%)'

export default function RGBRangeFilter({ value, onChange }: RGBRangeFilterProps) {
	const [minVal, setMinVal] = useState(0)
	const [maxVal, setMaxVal] = useState(255)
	const activeThumbRef = useRef<'min' | 'max' | null>(null)
	const [pendingValue, setPendingValue] = useState<string | undefined>(undefined)
	const trackRef = useRef<HTMLDivElement>(null)

	// Синхронизация из внешнего значения
	useEffect(() => {
		if (!value) {
			setMinVal(0)
			setMaxVal(255)
			return
		}
		const rangeMatch = value.match(/^(\d{1,3})-(\d{1,3})$/)
		if (rangeMatch) {
			const nextMin = Math.max(0, Math.min(255, parseInt(rangeMatch[1], 10)))
			const nextMax = Math.max(0, Math.min(255, parseInt(rangeMatch[2], 10)))
			setMinVal(Math.min(nextMin, nextMax))
			setMaxVal(Math.max(nextMin, nextMax))
			return
		}
		const brightness = getBrightness(value)
		if (brightness !== null) {
			setMinVal(brightness)
			setMaxVal(brightness)
		} else {
			setMinVal(0)
			setMaxVal(255)
		}
	}, [value])

	const updateRange = (source: 'min' | 'max', rawValue: number) => {
		if (source === 'min') {
			const clampedMin = Math.max(0, Math.min(maxVal - 1, rawValue))
			const finalMin = Number.isNaN(clampedMin) ? minVal : clampedMin
			setMinVal(finalMin)
			setPendingValue(finalMin === 0 && maxVal === 255 ? undefined : `${finalMin}-${maxVal}`)
		} else {
			const clampedMax = Math.max(minVal + 1, Math.min(255, rawValue))
			const finalMax = Number.isNaN(clampedMax) ? maxVal : clampedMax
			setMaxVal(finalMax)
			setPendingValue(minVal === 0 && finalMax === 255 ? undefined : `${minVal}-${finalMax}`)
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
		return Math.round(x * 255)
	}

	const handlePointerDown = (e: React.PointerEvent) => {
		const track = trackRef.current
		if (!track) return
		const rect = track.getBoundingClientRect()
		const x = (e.clientX - rect.left) / rect.width
		const minX = minVal / 255
		const maxX = maxVal / 255
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

	const minPercent = (minVal / 255) * 100
	const maxPercent = (maxVal / 255) * 100

	return (
		<div className='w-full py-3'>
			<div className='mb-1 flex justify-between text-[11px] text-gray-500'>
				<span>Диапазон цвета</span>
				<span>
					{minVal}–{maxVal}
				</span>
			</div>

			<div
				ref={trackRef}
				className='relative select-none touch-none'
				style={{
					// Высота 44px — минимальная область касания для мобильных (ползунки проще двигать)
					height: 44,
					minHeight: 44,
				}}
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove}
				onPointerUp={handlePointerUp}
				onPointerLeave={handlePointerUp}
			>
				{/* Радужная полоса: чёрный (0) → радуга → белый (255) по номерам яркости из Excel */}
				<div
					className='absolute rounded-full'
					style={{
						left: 0,
						right: 0,
						top: (44 - TRACK_HEIGHT) / 2,
						height: TRACK_HEIGHT,
						background: RAINBOW_GRADIENT,
					}}
				/>

				{/* Заливка выбранного диапазона */}
				<div
					className='absolute rounded-full bg-white/40 pointer-events-none'
					style={{
						left: `${minPercent}%`,
						width: `${Math.max(maxPercent - minPercent, 2)}%`,
						top: (44 - TRACK_HEIGHT) / 2,
						height: TRACK_HEIGHT,
					}}
				/>

				{/* Левый ползунок */}
				<div
					className='absolute w-[18px] h-[18px] rounded-full bg-[#1976D2] border-[3px] border-white shadow-[0_2px_6px_rgba(0,0,0,0.3)] cursor-grab active:cursor-grabbing pointer-events-none'
					style={{
						left: `calc(${minPercent}% - ${THUMB_SIZE / 2}px)`,
						top: (44 - THUMB_SIZE) / 2,
					}}
				/>
				{/* Правый ползунок */}
				<div
					className='absolute w-[18px] h-[18px] rounded-full bg-[#1976D2] border-[3px] border-white shadow-[0_2px_6px_rgba(0,0,0,0.3)] cursor-grab active:cursor-grabbing pointer-events-none'
					style={{
						left: `calc(${maxPercent}% - ${THUMB_SIZE / 2}px)`,
						top: (44 - THUMB_SIZE) / 2,
					}}
				/>
			</div>
		</div>
	)
}
