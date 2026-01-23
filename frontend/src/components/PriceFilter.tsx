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
		const newMin = Math.min(Number(e.target.value), localMax - 1)
		setLocalMin(newMin)
		onChange({ min: newMin, max: localMax })
	}

	const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newMax = Math.max(Number(e.target.value), localMin + 1)
		setLocalMax(newMax)
		onChange({ min: localMin, max: newMax })
	}

	const handleReset = () => {
		setLocalMin(minPrice)
		setLocalMax(maxPrice)
		onChange(undefined)
	}

	return (
		<div className='bg-white rounded-xl p-6 shadow-card border border-gray2'>
			<div className='flex items-center justify-between mb-4'>
				<h3 className='text-lg font-bold text-black'>Цена</h3>
				{(value?.min !== minPrice || value?.max !== maxPrice) && (
					<button
						onClick={handleReset}
						className='text-sm text-main1 hover:text-main2 font-medium'
					>
						Сбросить
					</button>
				)}
			</div>

			<div className='space-y-4'>
				{/* Ползунки */}
				<div className='relative'>
					<input
						type='range'
						min={minPrice}
						max={maxPrice}
						value={localMin}
						onChange={handleMinChange}
						className='absolute w-full h-2 bg-gray2 rounded-lg appearance-none cursor-pointer z-10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-main1 [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-main1 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer'
						style={{
							background: `linear-gradient(to right, 
								#1976D2 0%, 
								#1976D2 ${((localMin - minPrice) / (maxPrice - minPrice)) * 100}%, 
								#D6D5D4 ${((localMin - minPrice) / (maxPrice - minPrice)) * 100}%, 
								#D6D5D4 100%)`,
						}}
					/>
					<input
						type='range'
						min={minPrice}
						max={maxPrice}
						value={localMax}
						onChange={handleMaxChange}
						className='absolute w-full h-2 bg-transparent rounded-lg appearance-none cursor-pointer z-20 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-main1 [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-main1 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer'
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
