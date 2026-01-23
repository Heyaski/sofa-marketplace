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
		const newMin = Math.min(Number(e.target.value), localWidthMax - 1)
		setLocalWidthMin(newMin)
		onChange({
			width: { min: newMin, max: localWidthMax },
			depth: { min: localDepthMin, max: localDepthMax },
		})
	}

	const handleWidthMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newMax = Math.max(Number(e.target.value), localWidthMin + 1)
		setLocalWidthMax(newMax)
		onChange({
			width: { min: localWidthMin, max: newMax },
			depth: { min: localDepthMin, max: localDepthMax },
		})
	}

	const handleDepthMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newMin = Math.min(Number(e.target.value), localDepthMax - 1)
		setLocalDepthMin(newMin)
		onChange({
			width: { min: localWidthMin, max: localWidthMax },
			depth: { min: newMin, max: localDepthMax },
		})
	}

	const handleDepthMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newMax = Math.max(Number(e.target.value), localDepthMin + 1)
		setLocalDepthMax(newMax)
		onChange({
			width: { min: localWidthMin, max: localWidthMax },
			depth: { min: localDepthMin, max: newMax },
		})
	}

	const handleReset = () => {
		setLocalWidthMin(minWidth)
		setLocalWidthMax(maxWidth)
		setLocalDepthMin(minDepth)
		setLocalDepthMax(maxDepth)
		onChange(undefined)
	}

	const handleApply = () => {
		onChange({
			width: { min: localWidthMin, max: localWidthMax },
			depth: { min: localDepthMin, max: localDepthMax },
		})
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
		<div className='bg-white rounded-xl p-6 shadow-card border border-gray2' onClick={(e) => e.stopPropagation()}>
			<div className='flex items-center justify-between mb-4'>
				<h3 className='text-lg font-bold text-black'>Габариты</h3>
				<div className='flex items-center gap-3'>
					{!isDefault && (
						<button
							onClick={handleReset}
							className='text-sm text-gray hover:text-black font-medium'
						>
							Сбросить
						</button>
					)}
					<button
						onClick={handleApply}
						className='px-4 py-2 bg-main1 text-white rounded-lg text-sm font-medium hover:bg-main2 transition-colors'
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
						<div className='relative'>
							<input
								type='range'
								min={minWidth}
								max={maxWidth}
								value={localWidthMin}
								onChange={handleWidthMinChange}
								className='absolute w-full h-2 bg-gray2 rounded-lg appearance-none cursor-pointer z-10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-main1 [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-main1 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer'
								style={{
									background: `linear-gradient(to right, 
										#1976D2 0%, 
										#1976D2 ${((localWidthMin - minWidth) / (maxWidth - minWidth)) * 100}%, 
										#D6D5D4 ${((localWidthMin - minWidth) / (maxWidth - minWidth)) * 100}%, 
										#D6D5D4 100%)`,
								}}
							/>
							<input
								type='range'
								min={minWidth}
								max={maxWidth}
								value={localWidthMax}
								onChange={handleWidthMaxChange}
								className='absolute w-full h-2 bg-transparent rounded-lg appearance-none cursor-pointer z-20 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-main1 [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-main1 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer'
							/>
						</div>
						<div className='flex items-center justify-between gap-4'>
							<div className='flex-1'>
								<input
									type='number'
									min={minWidth}
									max={maxWidth}
									value={localWidthMin}
									onChange={handleWidthMinChange}
									className='w-full px-3 py-2 rounded-lg border border-gray2 bg-white text-black text-sm focus:outline-none focus:ring-2 focus:ring-main1'
								/>
							</div>
							<span className='text-gray'>—</span>
							<div className='flex-1'>
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
						<div className='relative'>
							<input
								type='range'
								min={minDepth}
								max={maxDepth}
								value={localDepthMin}
								onChange={handleDepthMinChange}
								className='absolute w-full h-2 bg-gray2 rounded-lg appearance-none cursor-pointer z-10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-main1 [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-main1 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer'
								style={{
									background: `linear-gradient(to right, 
										#1976D2 0%, 
										#1976D2 ${((localDepthMin - minDepth) / (maxDepth - minDepth)) * 100}%, 
										#D6D5D4 ${((localDepthMin - minDepth) / (maxDepth - minDepth)) * 100}%, 
										#D6D5D4 100%)`,
								}}
							/>
							<input
								type='range'
								min={minDepth}
								max={maxDepth}
								value={localDepthMax}
								onChange={handleDepthMaxChange}
								className='absolute w-full h-2 bg-transparent rounded-lg appearance-none cursor-pointer z-20 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-main1 [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-main1 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer'
							/>
						</div>
						<div className='flex items-center justify-between gap-4'>
							<div className='flex-1'>
								<input
									type='number'
									min={minDepth}
									max={maxDepth}
									value={localDepthMin}
									onChange={handleDepthMinChange}
									className='w-full px-3 py-2 rounded-lg border border-gray2 bg-white text-black text-sm focus:outline-none focus:ring-2 focus:ring-main1'
								/>
							</div>
							<span className='text-gray'>—</span>
							<div className='flex-1'>
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
