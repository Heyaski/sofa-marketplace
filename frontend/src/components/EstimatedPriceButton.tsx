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
					className='absolute left-1/2 top-full z-[60] mt-2 w-[min(calc(100vw-1.5rem),380px)] min-w-[280px] -translate-x-1/2 rounded-xl border border-gray2 bg-white p-4 text-left shadow-lg'
					onClick={e => e.stopPropagation()}
				>
					<p className='mb-1.5 text-xs text-gray'>Ориентировочная цена товара</p>
					<p className='mb-4 text-base font-semibold leading-snug text-black whitespace-normal sm:whitespace-nowrap'>
						от {formatRub(min)} до {formatRub(max)}
					</p>
					{min < max ? (
						<>
							<label className='mb-3 block text-xs text-gray'>Уточнить по шкале</label>
							<div className='flex min-h-[44px] w-full items-center'>
								<input
									type='range'
									min={min}
									max={max}
									step={Math.max(1, Math.round((max - min) / 100))}
									value={sliderValue}
									onChange={e => setSliderValue(Number(e.target.value))}
									className='range-pill w-full max-w-full cursor-pointer bg-transparent'
								/>
							</div>
							<p className='mt-4 text-sm text-black'>
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
