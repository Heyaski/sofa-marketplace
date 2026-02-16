'use client'

import React, { useEffect, useState } from 'react'

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

export default function RGBRangeFilter({ value, onChange }: RGBRangeFilterProps) {
	const [minVal, setMinVal] = useState(0)
	const [maxVal, setMaxVal] = useState(255)
	// Локальное значение, из которого с дебаунсом дергаем onChange
	const [pendingValue, setPendingValue] = useState<string | undefined>(undefined)

	// Синхронизация из внешнего значения
	useEffect(() => {
		if (!value) {
			setMinVal(0)
			setMaxVal(255)
			return
		}

		// Новый формат "min-max"
		const rangeMatch = value.match(/^(\d{1,3})-(\d{1,3})$/)
		if (rangeMatch) {
			const nextMin = Math.max(0, Math.min(255, parseInt(rangeMatch[1], 10)))
			const nextMax = Math.max(0, Math.min(255, parseInt(rangeMatch[2], 10)))
			setMinVal(Math.min(nextMin, nextMax))
			setMaxVal(Math.max(nextMin, nextMax))
			return
		}

		// Старый формат "r,g,b" — превращаем в точечный диапазон по яркости
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
			// Левый ползунок: 0 .. (текущий правый - 1)
			const clampedMin = Math.max(0, Math.min(maxVal - 1, rawValue))
			const finalMin = Number.isNaN(clampedMin) ? minVal : clampedMin
			setMinVal(finalMin)

			if (finalMin === 0 && maxVal === 255) {
				setPendingValue(undefined)
			} else {
				setPendingValue(`${finalMin}-${maxVal}`)
			}
		} else {
			// Правый ползунок: (текущий левый + 1) .. 255
			const clampedMax = Math.max(minVal + 1, Math.min(255, rawValue))
			const finalMax = Number.isNaN(clampedMax) ? maxVal : clampedMax
			setMaxVal(finalMax)

			if (minVal === 0 && finalMax === 255) {
				setPendingValue(undefined)
			} else {
				setPendingValue(`${minVal}-${finalMax}`)
			}
		}
	}

	const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const next = parseInt(e.target.value, 10)
		updateRange('min', next)
	}

	const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const next = parseInt(e.target.value, 10)
		updateRange('max', next)
	}

	// Дебаунс, чтобы не дёргать каталог при каждом пикселе движения
	useEffect(() => {
		const id = window.setTimeout(() => {
			onChange(pendingValue)
		}, 250)
		return () => window.clearTimeout(id)
	}, [pendingValue, onChange])

	const minPercent = (minVal / 255) * 100
	const maxPercent = (maxVal / 255) * 100

	return (
		<div className='w-full py-3'>
			<div className='mb-1 flex justify-between text-[11px] text-gray-500'>
				<span>Диапазон цвета (яркость)</span>
				<span>
					{minVal}–{maxVal}
				</span>
			</div>

			<div className='relative h-6'>
				{/* Радужная полоса */}
				<div
					className='absolute inset-0 rounded-full'
					style={{
						background:
							'linear-gradient(90deg, #ff0000, #ff7f00, #ffff00, #00ff00, #00ffff, #0000ff, #8b00ff)',
					}}
				/>

				{/* Заливка выбранного диапазона */}
				<div
					className='absolute h-full rounded-full bg-white/40 pointer-events-none'
					style={{
						left: `${minPercent}%`,
						width: `${Math.max(maxPercent - minPercent, 2)}%`,
					}}
				/>

				{/* Два range-инпута поверх — оба по центру по вертикали */}
				<input
					type='range'
					min={0}
					max={255}
					value={minVal}
					onChange={handleMinChange}
					className='absolute left-0 right-0 top-0 bottom-0 w-full appearance-none bg-transparent pointer-events-auto'
					style={{ zIndex: 2 }}
				/>
				<input
					type='range'
					min={0}
					max={255}
					value={maxVal}
					onChange={handleMaxChange}
					className='absolute left-0 right-0 top-0 bottom-0 w-full appearance-none bg-transparent pointer-events-auto'
					style={{ zIndex: 3 }}
				/>
			</div>
		</div>
	)
}

