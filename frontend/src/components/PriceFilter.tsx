'use client'

import { useEffect, useRef, useState } from 'react'

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
	const THUMB_SIZE = 18
	const TRACK_HEIGHT = 8
	const DRAG_AREA_HEIGHT = 36
	const rangeMin = 0
	const rangeMax = Math.max(maxPrice, 0)
	const [localMin, setLocalMin] = useState(value?.min ?? 0)
	const [localMax, setLocalMax] = useState(value?.max ?? 0)
	const [pendingValue, setPendingValue] = useState<{ min: number; max: number } | undefined>(value)
	const activeThumbRef = useRef<'min' | 'max' | null>(null)
	const trackRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (value) {
			setLocalMin(value.min)
			setLocalMax(value.max)
			setPendingValue({ min: value.min, max: value.max })
		} else {
			setLocalMin(0)
			setLocalMax(0)
			setPendingValue(undefined)
		}
	}, [value?.min, value?.max])

	useEffect(() => {
		const id = window.setTimeout(() => {
			onChange(pendingValue)
		}, 180)
		return () => window.clearTimeout(id)
	}, [pendingValue, onChange])

	const emitChange = (nextMin: number, nextMax: number) => {
		if (nextMin === 0 && nextMax === 0) {
			setPendingValue(undefined)
			return
		}
		setPendingValue({ min: nextMin, max: nextMax })
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
	
	const handleReset = () => {
		setLocalMin(0)
		setLocalMax(0)
		setPendingValue(undefined)
	}

	const valueFromX = (clientX: number): number => {
		const track = trackRef.current
		if (!track) return 0
		const rect = track.getBoundingClientRect()
		const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
		return Math.round(x * Math.max(rangeMax - rangeMin, 1) + rangeMin)
	}

	const updateByPointer = (thumb: 'min' | 'max', clientX: number) => {
		const raw = valueFromX(clientX)
		if (thumb === 'min') {
			const nextMin = Math.min(Math.max(raw, rangeMin), localMax)
			setLocalMin(nextMin)
			emitChange(nextMin, localMax)
			return
		}
		const nextMax = Math.max(Math.min(raw, rangeMax), localMin)
		setLocalMax(nextMax)
		emitChange(localMin, nextMax)
	}

	const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
		const track = trackRef.current
		if (!track) return
		const rect = track.getBoundingClientRect()
		const x = (e.clientX - rect.left) / rect.width
		const minX = (localMin - rangeMin) / Math.max(rangeMax - rangeMin, 1)
		const maxX = (localMax - rangeMin) / Math.max(rangeMax - rangeMin, 1)
		const mid = (minX + maxX) / 2
		const thumb: 'min' | 'max' = x <= mid ? 'min' : 'max'
		activeThumbRef.current = thumb
		updateByPointer(thumb, e.clientX)
		e.currentTarget.setPointerCapture(e.pointerId)
		e.preventDefault()
	}

	const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
		const thumb = activeThumbRef.current
		if (!thumb) return
		updateByPointer(thumb, e.clientX)
		e.preventDefault()
	}

	const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
		activeThumbRef.current = null
		if (e.currentTarget.hasPointerCapture(e.pointerId)) {
			e.currentTarget.releasePointerCapture(e.pointerId)
		}
	}

	const minPercent = ((localMin - rangeMin) / Math.max(rangeMax - rangeMin, 1)) * 100
	const maxPercent = ((localMax - rangeMin) / Math.max(rangeMax - rangeMin, 1)) * 100

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
				<div
					ref={trackRef}
					className='relative select-none touch-none'
					style={{ height: DRAG_AREA_HEIGHT, minHeight: DRAG_AREA_HEIGHT }}
					onPointerDown={handlePointerDown}
					onPointerMove={handlePointerMove}
					onPointerUp={handlePointerUp}
					onPointerCancel={handlePointerUp}
					onPointerLeave={handlePointerUp}
				>
					<div
						className='absolute w-full bg-gray2 rounded-lg'
						style={{
							top: (DRAG_AREA_HEIGHT - TRACK_HEIGHT) / 2,
							height: TRACK_HEIGHT,
						}}
					/>
					<div
						className='absolute bg-main1 rounded-lg'
						style={{
							left: `${minPercent}%`,
							width: `${Math.max(maxPercent - minPercent, 0)}%`,
							top: (DRAG_AREA_HEIGHT - TRACK_HEIGHT) / 2,
							height: TRACK_HEIGHT,
						}}
					/>
					<div
						className='absolute rounded-full border-[3px] border-white shadow-[0_1px_4px_rgba(0,0,0,0.2)] pointer-events-none'
						style={{
							width: THUMB_SIZE,
							height: THUMB_SIZE,
							left: `calc(${minPercent}% - ${THUMB_SIZE / 2}px)`,
							top: (DRAG_AREA_HEIGHT - THUMB_SIZE) / 2,
							background: '#1976d2',
						}}
					/>
					<div
						className='absolute rounded-full border-[3px] border-white shadow-[0_1px_4px_rgba(0,0,0,0.2)] pointer-events-none'
						style={{
							width: THUMB_SIZE,
							height: THUMB_SIZE,
							left: `calc(${maxPercent}% - ${THUMB_SIZE / 2}px)`,
							top: (DRAG_AREA_HEIGHT - THUMB_SIZE) / 2,
							background: '#1976d2',
						}}
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
