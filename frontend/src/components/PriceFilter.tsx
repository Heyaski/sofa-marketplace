'use client'

import { useState, useEffect } from 'react'

interface PriceFilterProps {
	minPrice: number
	maxPrice: number
	value: { min: number; max: number } | undefined
	onChange: (value: { min: number; max: number } | undefined) => void
	onApply?: () => void
}

export default function PriceFilter({
	minPrice,
	maxPrice,
	value,
	onChange,
	onApply,
}: PriceFilterProps) {
	const [localMin, setLocalMin] = useState(value?.min ?? minPrice)
	const [localMax, setLocalMax] = useState(value?.max ?? maxPrice)

	useEffect(() => {
		if (value) {
			setLocalMin(value.min)
			setLocalMax(value.max)
		} else {
			setLocalMin(minPrice)
			setLocalMax(maxPrice)
		}
	}, [value, minPrice, maxPrice])

	const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = Number(e.target.value)
		const newMin = Math.min(Math.max(val, minPrice), localMax - 1)
		setLocalMin(newMin)
	}

	const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = Number(e.target.value)
		const newMax = Math.max(Math.min(val, maxPrice), localMin + 1)
		setLocalMax(newMax)
	}
	
	const handleRangeMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = Number(e.target.value)
		const newMin = Math.min(Math.max(val, minPrice), localMax - 1)
		setLocalMin(newMin)
	}

	const handleRangeMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = Number(e.target.value)
		const newMax = Math.max(Math.min(val, maxPrice), localMin + 1)
		setLocalMax(newMax)
	}

	const handleReset = () => {
		setLocalMin(minPrice)
		setLocalMax(maxPrice)
		onChange(undefined)
	}

	const handleApply = () => {
		if (localMin !== minPrice || localMax !== maxPrice) {
			onChange({ min: localMin, max: localMax })
		} else {
			onChange(undefined)
		}
		// Закрываем фильтр после применения
		if (onApply) {
			onApply()
		}
	}

	return (
		<div className='bg-white rounded-lg shadow-lg border border-gray2 p-4' onClick={(e) => e.stopPropagation()}>
			<div className='flex items-center justify-between mb-4'>
				<h3 className='text-sm font-bold text-black'>Цена</h3>
				<div className='flex items-center gap-3'>
					{(localMin !== minPrice || localMax !== maxPrice) && (
						<button
							onClick={handleReset}
							className='text-xs text-gray hover:text-black font-medium'
						>
							Сбросить
						</button>
					)}
					<button
						onClick={handleApply}
						className='px-3 py-1.5 bg-main1 text-white rounded-lg text-xs font-medium hover:bg-main2 transition-colors'
					>
						Применить
					</button>
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
							left: `${((localMin - minPrice) / (maxPrice - minPrice)) * 100}%`,
							width: `${((localMax - localMin) / (maxPrice - minPrice)) * 100}%`,
							zIndex: 5,
						}}
					></div>
					{/* Минимальный ползунок */}
					<input
						type='range'
						min={minPrice}
						max={maxPrice}
						value={localMin}
						onChange={handleRangeMinChange}
						className='absolute w-full h-2 bg-transparent appearance-none cursor-pointer'
						style={{ zIndex: 10 }}
					/>
					{/* Максимальный ползунок */}
					<input
						type='range'
						min={minPrice}
						max={maxPrice}
						value={localMax}
						onChange={handleRangeMaxChange}
						className='absolute w-full h-2 bg-transparent appearance-none cursor-pointer'
						style={{ zIndex: 20 }}
					/>
				</div>

				{/* Значения */}
				<div className='flex items-center justify-between gap-4'>
					<div className='flex-1'>
						<label className='block text-sm text-gray mb-1'>От</label>
						<input
							type='number'
							min={minPrice}
							max={maxPrice}
							value={localMin}
							onChange={handleMinChange}
							className='w-full px-3 py-2 rounded-lg border border-gray2 bg-white text-black text-sm focus:outline-none focus:ring-2 focus:ring-main1'
						/>
					</div>
					<div className='flex-1'>
						<label className='block text-sm text-gray mb-1'>До</label>
						<input
							type='number'
							min={minPrice}
							max={maxPrice}
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
