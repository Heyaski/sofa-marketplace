'use client'

import { useState, useEffect } from 'react'

interface PriceFilterProps {
	minPrice: number
	maxPrice: number
	value: { min: number; max: number } | undefined
	onChange: (value: { min: number; max: number } | undefined) => void
}

export default function PriceFilter({
	minPrice,
	maxPrice,
	value,
	onChange,
}: PriceFilterProps) {
	const rangeMin = 0
	const rangeMax = Math.max(maxPrice, 0)
	const [localMin, setLocalMin] = useState(value?.min ?? 0)
	const [localMax, setLocalMax] = useState(value?.max ?? 0)

	useEffect(() => {
		if (value) {
			setLocalMin(value.min)
			setLocalMax(value.max)
		} else {
			setLocalMin(0)
			setLocalMax(0)
		}
	}, [value])

	const emitChange = (nextMin: number, nextMax: number) => {
		if (nextMin === 0 && nextMax === 0) {
			onChange(undefined)
			return
		}
		onChange({ min: nextMin, max: nextMax })
	}

	const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = Number(e.target.value)
		const newMin = Math.min(Math.max(val, rangeMin), localMax)
		setLocalMin(newMin)
		emitChange(newMin, localMax)
	}

	const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = Number(e.target.value)
		const newMax = Math.max(Math.min(val, rangeMax), localMin)
		setLocalMax(newMax)
		emitChange(localMin, newMax)
	}
	
	const handleRangeMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = Number(e.target.value)
		const newMin = Math.min(Math.max(val, rangeMin), localMax)
		setLocalMin(newMin)
		emitChange(newMin, localMax)
	}

	const handleRangeMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = Number(e.target.value)
		const newMax = Math.max(Math.min(val, rangeMax), localMin)
		setLocalMax(newMax)
		emitChange(localMin, newMax)
	}

	const handleReset = () => {
		setLocalMin(0)
		setLocalMax(0)
		onChange(undefined)
	}

	return (
		<div className='bg-white rounded-lg shadow-lg border border-gray2 p-4' onClick={(e) => e.stopPropagation()}>
			<div className='flex items-center justify-between mb-4'>
				<h3 className='text-sm font-bold text-black'>Цена</h3>
				<div className='flex items-center gap-3'>
					{(localMin !== 0 || localMax !== 0) && (
						<button
							onClick={handleReset}
							className='text-xs text-gray hover:text-black font-medium'
						>
							Сбросить
						</button>
					)}
				</div>
			</div>

			<div className='space-y-4'>
				{/* Ползунки */}
				<div className='relative h-2'>
					{/* Фон ползунка */}
					<div className='absolute w-full h-2 bg-gray2 rounded-lg' style={{ zIndex: 0 }}></div>
					{/* Выбранный диапазон */}
					<div 
						className='absolute h-2 bg-main1 rounded-lg'
						style={{
							left: `${((localMin - rangeMin) / Math.max(rangeMax - rangeMin, 1)) * 100}%`,
							width: `${((localMax - localMin) / Math.max(rangeMax - rangeMin, 1)) * 100}%`,
							zIndex: 5,
						}}
					></div>
					{/* Минимальный ползунок */}
					<input
						type='range'
						min={rangeMin}
						max={rangeMax}
						value={localMin}
						onChange={handleRangeMinChange}
						className='absolute w-full h-2 bg-transparent appearance-none cursor-pointer price-range'
						style={{ zIndex: 10 }}
					/>
					{/* Максимальный ползунок */}
					<input
						type='range'
						min={rangeMin}
						max={rangeMax}
						value={localMax}
						onChange={handleRangeMaxChange}
						className='absolute w-full h-2 bg-transparent appearance-none cursor-pointer price-range'
						style={{ zIndex: 20 }}
					/>
				</div>

				{/* Значения */}
				<div className='flex items-center justify-between gap-4'>
					<div className='flex-1'>
						<label className='block text-sm text-gray mb-1'>От</label>
						<input
							type='number'
							min={rangeMin}
							max={rangeMax}
							value={localMin}
							onChange={handleMinChange}
							className='w-full px-3 py-2 rounded-lg border border-gray2 bg-white text-black text-sm focus:outline-none focus:ring-2 focus:ring-main1'
						/>
					</div>
					<div className='flex-1'>
						<label className='block text-sm text-gray mb-1'>До</label>
						<input
							type='number'
							min={rangeMin}
							max={rangeMax}
							value={localMax}
							onChange={handleMaxChange}
							className='w-full px-3 py-2 rounded-lg border border-gray2 bg-white text-black text-sm focus:outline-none focus:ring-2 focus:ring-main1'
						/>
					</div>
				</div>
			</div>
		</div>
	)
}
