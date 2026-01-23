'use client'

import { useState } from 'react'

interface MultiSelectFilterProps {
	title: string
	options: string[]
	selectedValues: string[] | undefined
	onChange: (values: string[] | undefined) => void
}

export default function MultiSelectFilter({
	title,
	options,
	selectedValues = [],
	onChange,
}: MultiSelectFilterProps) {
	const [isOpen, setIsOpen] = useState(false)

	const handleToggle = (value: string) => {
		const newValues = selectedValues?.includes(value)
			? selectedValues.filter(v => v !== value)
			: [...(selectedValues || []), value]
		onChange(newValues.length > 0 ? newValues : undefined)
	}

	const handleReset = () => {
		onChange(undefined)
	}

	const hasSelection = selectedValues && selectedValues.length > 0

	return (
		<div className='bg-white rounded-xl p-6 shadow-card border border-gray2' onClick={(e) => e.stopPropagation()}>
			<div className='flex items-center justify-between mb-4'>
				<h3 className='text-lg font-bold text-black'>{title}</h3>
				{hasSelection && (
					<button
						onClick={handleReset}
						className='text-sm text-gray hover:text-black font-medium'
					>
						Сбросить
					</button>
				)}
			</div>

			<div className='space-y-2 max-h-64 overflow-y-auto'>
				{options.map(option => (
					<label
						key={option}
						className='flex items-center space-x-3 cursor-pointer hover:bg-gray-bg p-2 rounded-lg transition-colors'
					>
						<input
							type='checkbox'
							checked={selectedValues?.includes(option) || false}
							onChange={() => handleToggle(option)}
							className='w-5 h-5 text-main1 border-gray2 rounded focus:ring-2 focus:ring-main1 cursor-pointer'
						/>
						<span className='text-sm text-black'>{option}</span>
					</label>
				))}
			</div>
		</div>
	)
}
