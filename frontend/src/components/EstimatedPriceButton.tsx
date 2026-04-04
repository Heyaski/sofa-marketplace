'use client'

import { useEffect, useRef, useState } from 'react'
import type { Product } from '@/types'
import { formatRub, getEstimatedPriceRange } from '@/utils/estimatedPrice'

interface EstimatedPriceButtonProps {
	product: Product
	className?: string
}

export default function EstimatedPriceButton({ product, className = '' }: EstimatedPriceButtonProps) {
	const [open, setOpen] = useState(false)
	const wrapRef = useRef<HTMLDivElement>(null)
	const price = Number(product.price)
	const { min, max } = getEstimatedPriceRange(price)
	const canShow = Number.isFinite(price) && price > 0 && max > 0
	const [sliderValue, setSliderValue] = useState(() =>
		Math.min(max, Math.max(min, Math.round(price)))
	)

	useEffect(() => {
		if (!open) return
		const v = Math.min(max, Math.max(min, Math.round(price)))
		setSliderValue(v)
	}, [open, min, max, price])

	useEffect(() => {
		if (!open) return
		const onDown = (e: MouseEvent) => {
			if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
				setOpen(false)
			}
		}
		document.addEventListener('mousedown', onDown)
		return () => document.removeEventListener('mousedown', onDown)
	}, [open])

	if (!canShow) return null

	return (
		<div ref={wrapRef} className={`relative ${className}`}>
			<button
				type='button'
				onClick={e => {
					e.stopPropagation()
					setOpen(v => !v)
				}}
				className='w-full py-2 px-3 text-sm font-medium rounded-lg border border-gray2 text-black bg-white hover:bg-gray-bg hover:border-main1 hover:text-main1 transition-colors'
			>
				Ориентировочная цена
			</button>
			{open && (
				<div
					className='absolute left-0 right-0 top-full mt-2 z-50 bg-white rounded-lg shadow-lg border border-gray2 p-3 sm:p-4 text-left'
					onClick={e => e.stopPropagation()}
				>
					<p className='text-xs text-gray mb-2'>Ориентировочная цена товара</p>
					<p className='text-sm font-semibold text-black mb-3'>
						от {formatRub(min)} до {formatRub(max)}
					</p>
					{min < max ? (
						<>
							<label className='block text-xs text-gray mb-1'>Уточнить по шкале</label>
							<input
								type='range'
								min={min}
								max={max}
								step={Math.max(1, Math.round((max - min) / 100))}
								value={sliderValue}
								onChange={e => setSliderValue(Number(e.target.value))}
								className='w-full accent-main1 h-2'
							/>
							<p className='text-sm text-black mt-2'>
								Выбрано:{' '}
								<span className='font-medium text-main1'>{formatRub(sliderValue)}</span>
							</p>
						</>
					) : (
						<p className='text-xs text-gray'>В каталоге указана одна ориентировочная величина.</p>
					)}
				</div>
			)}
		</div>
	)
}
