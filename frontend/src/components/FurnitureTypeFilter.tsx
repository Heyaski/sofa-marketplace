'use client'

interface Option {
	id: number
	name: string
}

interface FurnitureTypeFilterProps {
	title: string
	options: Option[]
	selectedIds: number[]
	onChange: (ids: number[]) => void
}

/** Фильтр «Вид мебели» — чекбоксы как на hh.ru, множественный выбор */
export default function FurnitureTypeFilter({
	title,
	options,
	selectedIds,
	onChange,
}: FurnitureTypeFilterProps) {
	const handleToggle = (id: number) => {
		const next = selectedIds.includes(id)
			? selectedIds.filter(x => x !== id)
			: [...selectedIds, id]
		onChange(next.length > 0 ? next : [])
	}

	const handleReset = () => {
		onChange([])
	}

	const hasSelection = selectedIds.length > 0

	return (
		<div className='bg-white rounded-lg shadow-lg border border-gray2' onClick={e => e.stopPropagation()}>
			<div className='flex items-center justify-between p-4 border-b border-gray2'>
				<h3 className='text-sm font-bold text-black'>{title}</h3>
				{hasSelection && (
					<button
						type='button'
						onClick={handleReset}
						className='text-xs text-gray hover:text-black font-medium'
					>
						Сбросить
					</button>
				)}
			</div>
			<div className='py-2 max-h-64 overflow-y-auto scrollbar-hide'>
				{options.map(opt => (
					<label
						key={opt.id}
						className='flex items-center gap-3 cursor-pointer hover:bg-gray-bg px-4 py-2.5 transition-colors min-h-[44px]'
					>
						<input
							type='checkbox'
							checked={selectedIds.includes(opt.id)}
							onChange={() => handleToggle(opt.id)}
							className='w-4 h-4 flex-shrink-0 text-main1 border-gray2 rounded focus:ring-2 focus:ring-main1 cursor-pointer accent-main1'
						/>
						<span className='text-sm text-black select-none'>{opt.name}</span>
					</label>
				))}
			</div>
		</div>
	)
}
