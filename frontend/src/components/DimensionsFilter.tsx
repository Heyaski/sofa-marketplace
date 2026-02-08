'use client'

import { useState, useEffect } from 'react'

interface DimensionsFilterProps {
	minWidth: number
	maxWidth: number
	minDepth: number
	maxDepth: number
	value: { width: { min: number; max: number }; depth: { min: number; max: number } } | undefined
	onChange: (value: { width: { min: number; max: number }; depth: { min: number; max: number } } | undefined) => void
	onApply?: () => void
}

export default function DimensionsFilter({
	minWidth,
	maxWidth,
	minDepth,
	maxDepth,
	value,
	onChange,
	onApply,
}: DimensionsFilterProps) {
	const [localWidthMin, setLocalWidthMin] = useState(value?.width.min ?? minWidth)
	const [localWidthMax, setLocalWidthMax] = useState(value?.width.max ?? maxWidth)
	const [localDepthMin, setLocalDepthMin] = useState(value?.depth.min ?? minDepth)
	const [localDepthMax, setLocalDepthMax] = useState(value?.depth.max ?? maxDepth)

	useEffect(() => {
		if (value) {
			setLocalWidthMin(value.width.min)
			setLocalWidthMax(value.width.max)
			setLocalDepthMin(value.depth.min)
			setLocalDepthMax(value.depth.max)
		} else {
			setLocalWidthMin(minWidth)
			setLocalWidthMax(maxWidth)
			setLocalDepthMin(minDepth)
			setLocalDepthMax(maxDepth)
		}
	}, [value, minWidth, maxWidth, minDepth, maxDepth])

	const handleWidthMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = Number(e.target.value)
		// Ограничиваем минимальное значение, но не больше максимального
		const newMin = Math.min(Math.max(val, minWidth), localWidthMax)
		setLocalWidthMin(newMin)
	}

	const handleWidthMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = Number(e.target.value)
		// Ограничиваем максимальное значение, но не меньше минимального
		const newMax = Math.max(Math.min(val, maxWidth), localWidthMin)
		setLocalWidthMax(newMax)
	}

	const handleDepthMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = Number(e.target.value)
		// Ограничиваем минимальное значение, но не больше максимального
		const newMin = Math.min(Math.max(val, minDepth), localDepthMax)
		setLocalDepthMin(newMin)
	}

	const handleDepthMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = Number(e.target.value)
		// Ограничиваем максимальное значение, но не меньше минимального
		const newMax = Math.max(Math.min(val, maxDepth), localDepthMin)
		setLocalDepthMax(newMax)
	}

	const handleWidthRangeMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = Number(e.target.value)
		// Ограничиваем минимальное значение, но не больше максимального
		const newMin = Math.min(Math.max(val, minWidth), localWidthMax)
		setLocalWidthMin(newMin)
	}

	const handleWidthRangeMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = Number(e.target.value)
		// Ограничиваем максимальное значение, но не меньше минимального
		const newMax = Math.max(Math.min(val, maxWidth), localWidthMin)
		setLocalWidthMax(newMax)
	}

	const handleDepthRangeMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = Number(e.target.value)
		// Ограничиваем минимальное значение, но не больше максимального
		const newMin = Math.min(Math.max(val, minDepth), localDepthMax)
		setLocalDepthMin(newMin)
	}

	const handleDepthRangeMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = Number(e.target.value)
		// Ограничиваем максимальное значение, но не меньше минимального
		const newMax = Math.max(Math.min(val, maxDepth), localDepthMin)
		setLocalDepthMax(newMax)
	}

	const handleReset = () => {
		setLocalWidthMin(minWidth)
		setLocalWidthMax(maxWidth)
		setLocalDepthMin(minDepth)
		setLocalDepthMax(maxDepth)
		onChange(undefined)
	}

	const handleApply = () => {
		if (localWidthMin !== minWidth || localWidthMax !== maxWidth || 
		    localDepthMin !== minDepth || localDepthMax !== maxDepth) {
			onChange({
				width: { min: localWidthMin, max: localWidthMax },
				depth: { min: localDepthMin, max: localDepthMax },
			})
		} else {
			onChange(undefined)
		}
		// Закрываем фильтр после применения
		if (onApply) {
			onApply()
		}
	}

	const isDefault =
		localWidthMin === minWidth &&
		localWidthMax === maxWidth &&
		localDepthMin === minDepth &&
		localDepthMax === maxDepth

	return (
		<div className='bg-white rounded-lg shadow-lg border border-gray2 p-3 sm:p-4 min-w-0' onClick={(e) => e.stopPropagation()}>
			<div className='flex items-center justify-between mb-4'>
				<h3 className='text-sm font-bold text-black'>Габариты</h3>
				<div className='flex items-center gap-3'>
					{!isDefault && (
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

			<div className='space-y-6'>
				{/* Ширина */}
				<div>
					<h4 className='text-sm font-medium text-black mb-3'>Ширина (см)</h4>
					<div className='space-y-3'>
						<div className='relative h-2'>
							{/* Фон ползунка */}
							<div className='absolute w-full h-2 bg-gray2 rounded-lg' style={{ zIndex: 0 }}></div>
							{/* Выбранный диапазон */}
							<div 
								className='absolute h-2 bg-main1 rounded-lg'
								style={{
									left: `${((localWidthMin - minWidth) / (maxWidth - minWidth)) * 100}%`,
									width: `${((localWidthMax - localWidthMin) / (maxWidth - minWidth)) * 100}%`,
									zIndex: 5,
								}}
							></div>
							{/* Минимальный ползунок */}
							<input
								type='range'
								min={minWidth}
								max={maxWidth}
								value={localWidthMin}
								onChange={handleWidthRangeMinChange}
								className='absolute w-full h-2 bg-transparent appearance-none cursor-pointer'
								style={{ zIndex: 10 }}
							/>
							{/* Максимальный ползунок */}
							<input
								type='range'
								min={minWidth}
								max={maxWidth}
								value={localWidthMax}
								onChange={handleWidthRangeMaxChange}
								className='absolute w-full h-2 bg-transparent appearance-none cursor-pointer'
								style={{ zIndex: 20 }}
							/>
						</div>
						<div className='flex items-center justify-between gap-2 sm:gap-4'>
							<div className='flex-1 min-w-0'>
								<input
									type='number'
									min={minWidth}
									max={maxWidth}
									value={localWidthMin}
									onChange={handleWidthMinChange}
									className='w-full px-3 py-2 rounded-lg border border-gray2 bg-white text-black text-sm focus:outline-none focus:ring-2 focus:ring-main1'
								/>
							</div>
							<span className='text-gray flex-shrink-0'>—</span>
							<div className='flex-1 min-w-0'>
								<input
									type='number'
									min={minWidth}
									max={maxWidth}
									value={localWidthMax}
									onChange={handleWidthMaxChange}
									className='w-full px-3 py-2 rounded-lg border border-gray2 bg-white text-black text-sm focus:outline-none focus:ring-2 focus:ring-main1'
								/>
							</div>
						</div>
					</div>
				</div>

				{/* Глубина */}
				<div>
					<h4 className='text-sm font-medium text-black mb-3'>Глубина (см)</h4>
					<div className='space-y-3'>
						<div className='relative h-2'>
							{/* Фон ползунка */}
							<div className='absolute w-full h-2 bg-gray2 rounded-lg' style={{ zIndex: 0 }}></div>
							{/* Выбранный диапазон */}
							<div 
								className='absolute h-2 bg-main1 rounded-lg'
								style={{
									left: `${((localDepthMin - minDepth) / (maxDepth - minDepth)) * 100}%`,
									width: `${((localDepthMax - localDepthMin) / (maxDepth - minDepth)) * 100}%`,
									zIndex: 5,
								}}
							></div>
							{/* Минимальный ползунок */}
							<input
								type='range'
								min={minDepth}
								max={maxDepth}
								value={localDepthMin}
								onChange={handleDepthRangeMinChange}
								className='absolute w-full h-2 bg-transparent appearance-none cursor-pointer'
								style={{ zIndex: 10 }}
							/>
							{/* Максимальный ползунок */}
							<input
								type='range'
								min={minDepth}
								max={maxDepth}
								value={localDepthMax}
								onChange={handleDepthRangeMaxChange}
								className='absolute w-full h-2 bg-transparent appearance-none cursor-pointer'
								style={{ zIndex: 20 }}
							/>
						</div>
						<div className='flex items-center justify-between gap-2 sm:gap-4'>
							<div className='flex-1 min-w-0'>
								<input
									type='number'
									min={minDepth}
									max={maxDepth}
									value={localDepthMin}
									onChange={handleDepthMinChange}
									className='w-full px-3 py-2 rounded-lg border border-gray2 bg-white text-black text-sm focus:outline-none focus:ring-2 focus:ring-main1'
								/>
							</div>
							<span className='text-gray flex-shrink-0'>—</span>
							<div className='flex-1 min-w-0'>
								<input
									type='number'
									min={minDepth}
									max={maxDepth}
									value={localDepthMax}
									onChange={handleDepthMaxChange}
									className='w-full px-3 py-2 rounded-lg border border-gray2 bg-white text-black text-sm focus:outline-none focus:ring-2 focus:ring-main1'
								/>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
