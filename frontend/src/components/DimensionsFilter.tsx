'use client'

import { useEffect, useRef, useState } from 'react'

interface DimensionsFilterProps {
	minWidth: number
	maxWidth: number
	minDepth: number
	maxDepth: number
	value: { width: { min: number; max: number }; depth: { min: number; max: number } } | undefined
	onChange: (value: { width: { min: number; max: number }; depth: { min: number; max: number } } | undefined) => void
}

export default function DimensionsFilter({
	minWidth,
	maxWidth,
	minDepth,
	maxDepth,
	value,
	onChange,
}: DimensionsFilterProps) {
	const THUMB_SIZE = 18
	const TRACK_HEIGHT = 8
	const DRAG_AREA_HEIGHT = 36
	const [localWidthMin, setLocalWidthMin] = useState(value?.width.min ?? minWidth)
	const [localWidthMax, setLocalWidthMax] = useState(value?.width.max ?? maxWidth)
	const [localDepthMin, setLocalDepthMin] = useState(value?.depth.min ?? minDepth)
	const [localDepthMax, setLocalDepthMax] = useState(value?.depth.max ?? maxDepth)
	const [pendingValue, setPendingValue] = useState<typeof value>(value)
	const activeWidthThumbRef = useRef<'min' | 'max' | null>(null)
	const activeDepthThumbRef = useRef<'min' | 'max' | null>(null)
	const widthTrackRef = useRef<HTMLDivElement>(null)
	const depthTrackRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (value) {
			setLocalWidthMin(value.width.min)
			setLocalWidthMax(value.width.max)
			setLocalDepthMin(value.depth.min)
			setLocalDepthMax(value.depth.max)
			setPendingValue({
				width: { min: value.width.min, max: value.width.max },
				depth: { min: value.depth.min, max: value.depth.max },
			})
		} else {
			setLocalWidthMin(minWidth)
			setLocalWidthMax(maxWidth)
			setLocalDepthMin(minDepth)
			setLocalDepthMax(maxDepth)
			setPendingValue(undefined)
		}
	}, [value?.width.min, value?.width.max, value?.depth.min, value?.depth.max, minWidth, maxWidth, minDepth, maxDepth])

	useEffect(() => {
		const id = window.setTimeout(() => {
			onChange(pendingValue)
		}, 180)
		return () => window.clearTimeout(id)
	}, [pendingValue, onChange])

	const emitChange = (
		nextWidthMin: number,
		nextWidthMax: number,
		nextDepthMin: number,
		nextDepthMax: number
	) => {
		if (
			nextWidthMin === minWidth &&
			nextWidthMax === maxWidth &&
			nextDepthMin === minDepth &&
			nextDepthMax === maxDepth
		) {
			setPendingValue(undefined)
			return
		}
		setPendingValue({
			width: { min: nextWidthMin, max: nextWidthMax },
			depth: { min: nextDepthMin, max: nextDepthMax },
		})
	}

	const handleWidthMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = Number(e.target.value)
		const newMin = Math.min(Math.max(val, minWidth), localWidthMax)
		setLocalWidthMin(newMin)
		emitChange(newMin, localWidthMax, localDepthMin, localDepthMax)
	}

	const handleWidthMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = Number(e.target.value)
		const newMax = Math.max(Math.min(val, maxWidth), localWidthMin)
		setLocalWidthMax(newMax)
		emitChange(localWidthMin, newMax, localDepthMin, localDepthMax)
	}

	const handleDepthMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = Number(e.target.value)
		const newMin = Math.min(Math.max(val, minDepth), localDepthMax)
		setLocalDepthMin(newMin)
		emitChange(localWidthMin, localWidthMax, newMin, localDepthMax)
	}

	const handleDepthMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = Number(e.target.value)
		const newMax = Math.max(Math.min(val, maxDepth), localDepthMin)
		setLocalDepthMax(newMax)
		emitChange(localWidthMin, localWidthMax, localDepthMin, newMax)
	}

	const handleReset = () => {
		setLocalWidthMin(minWidth)
		setLocalWidthMax(maxWidth)
		setLocalDepthMin(minDepth)
		setLocalDepthMax(maxDepth)
		setPendingValue(undefined)
	}

	const valueFromX = (
		clientX: number,
		track: HTMLDivElement | null,
		min: number,
		max: number
	): number => {
		if (!track) return min
		const rect = track.getBoundingClientRect()
		const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
		return Math.round(x * Math.max(max - min, 1) + min)
	}

	const handleWidthPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
		const track = widthTrackRef.current
		if (!track) return
		const rect = track.getBoundingClientRect()
		const x = (e.clientX - rect.left) / rect.width
		const minX = (localWidthMin - minWidth) / Math.max(maxWidth - minWidth, 1)
		const maxX = (localWidthMax - minWidth) / Math.max(maxWidth - minWidth, 1)
		const thumb: 'min' | 'max' = x <= (minX + maxX) / 2 ? 'min' : 'max'
		activeWidthThumbRef.current = thumb
		const raw = valueFromX(e.clientX, track, minWidth, maxWidth)
		if (thumb === 'min') {
			const nextMin = Math.min(Math.max(raw, minWidth), localWidthMax)
			setLocalWidthMin(nextMin)
			emitChange(nextMin, localWidthMax, localDepthMin, localDepthMax)
		} else {
			const nextMax = Math.max(Math.min(raw, maxWidth), localWidthMin)
			setLocalWidthMax(nextMax)
			emitChange(localWidthMin, nextMax, localDepthMin, localDepthMax)
		}
		e.currentTarget.setPointerCapture(e.pointerId)
		e.preventDefault()
	}

	const handleWidthPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
		const thumb = activeWidthThumbRef.current
		if (!thumb) return
		const raw = valueFromX(e.clientX, widthTrackRef.current, minWidth, maxWidth)
		if (thumb === 'min') {
			const nextMin = Math.min(Math.max(raw, minWidth), localWidthMax)
			setLocalWidthMin(nextMin)
			emitChange(nextMin, localWidthMax, localDepthMin, localDepthMax)
		} else {
			const nextMax = Math.max(Math.min(raw, maxWidth), localWidthMin)
			setLocalWidthMax(nextMax)
			emitChange(localWidthMin, nextMax, localDepthMin, localDepthMax)
		}
		e.preventDefault()
	}

	const handleWidthPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
		activeWidthThumbRef.current = null
		if (e.currentTarget.hasPointerCapture(e.pointerId)) {
			e.currentTarget.releasePointerCapture(e.pointerId)
		}
	}

	const handleDepthPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
		const track = depthTrackRef.current
		if (!track) return
		const rect = track.getBoundingClientRect()
		const x = (e.clientX - rect.left) / rect.width
		const minX = (localDepthMin - minDepth) / Math.max(maxDepth - minDepth, 1)
		const maxX = (localDepthMax - minDepth) / Math.max(maxDepth - minDepth, 1)
		const thumb: 'min' | 'max' = x <= (minX + maxX) / 2 ? 'min' : 'max'
		activeDepthThumbRef.current = thumb
		const raw = valueFromX(e.clientX, track, minDepth, maxDepth)
		if (thumb === 'min') {
			const nextMin = Math.min(Math.max(raw, minDepth), localDepthMax)
			setLocalDepthMin(nextMin)
			emitChange(localWidthMin, localWidthMax, nextMin, localDepthMax)
		} else {
			const nextMax = Math.max(Math.min(raw, maxDepth), localDepthMin)
			setLocalDepthMax(nextMax)
			emitChange(localWidthMin, localWidthMax, localDepthMin, nextMax)
		}
		e.currentTarget.setPointerCapture(e.pointerId)
		e.preventDefault()
	}

	const handleDepthPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
		const thumb = activeDepthThumbRef.current
		if (!thumb) return
		const raw = valueFromX(e.clientX, depthTrackRef.current, minDepth, maxDepth)
		if (thumb === 'min') {
			const nextMin = Math.min(Math.max(raw, minDepth), localDepthMax)
			setLocalDepthMin(nextMin)
			emitChange(localWidthMin, localWidthMax, nextMin, localDepthMax)
		} else {
			const nextMax = Math.max(Math.min(raw, maxDepth), localDepthMin)
			setLocalDepthMax(nextMax)
			emitChange(localWidthMin, localWidthMax, localDepthMin, nextMax)
		}
		e.preventDefault()
	}

	const handleDepthPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
		activeDepthThumbRef.current = null
		if (e.currentTarget.hasPointerCapture(e.pointerId)) {
			e.currentTarget.releasePointerCapture(e.pointerId)
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
				</div>
			</div>

			<div className='space-y-6'>
				{/* Ширина */}
				<div>
					<h4 className='text-sm font-medium text-black mb-3'>Ширина (см)</h4>
					<div className='space-y-3'>
						<div className='relative h-2'>
							<div
								ref={widthTrackRef}
								className='relative select-none touch-none'
								style={{ height: DRAG_AREA_HEIGHT, minHeight: DRAG_AREA_HEIGHT }}
								onPointerDown={handleWidthPointerDown}
								onPointerMove={handleWidthPointerMove}
								onPointerUp={handleWidthPointerUp}
								onPointerCancel={handleWidthPointerUp}
								onPointerLeave={handleWidthPointerUp}
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
										left: `${((localWidthMin - minWidth) / Math.max(maxWidth - minWidth, 1)) * 100}%`,
										width: `${((localWidthMax - localWidthMin) / Math.max(maxWidth - minWidth, 1)) * 100}%`,
										top: (DRAG_AREA_HEIGHT - TRACK_HEIGHT) / 2,
										height: TRACK_HEIGHT,
									}}
								/>
								<div
									className='absolute rounded-full border-[3px] border-white shadow-[0_1px_4px_rgba(0,0,0,0.2)] pointer-events-none'
									style={{
										width: THUMB_SIZE,
										height: THUMB_SIZE,
										left: `calc(${((localWidthMin - minWidth) / Math.max(maxWidth - minWidth, 1)) * 100}% - ${THUMB_SIZE / 2}px)`,
										top: (DRAG_AREA_HEIGHT - THUMB_SIZE) / 2,
										background: '#1976d2',
									}}
								/>
								<div
									className='absolute rounded-full border-[3px] border-white shadow-[0_1px_4px_rgba(0,0,0,0.2)] pointer-events-none'
									style={{
										width: THUMB_SIZE,
										height: THUMB_SIZE,
										left: `calc(${((localWidthMax - minWidth) / Math.max(maxWidth - minWidth, 1)) * 100}% - ${THUMB_SIZE / 2}px)`,
										top: (DRAG_AREA_HEIGHT - THUMB_SIZE) / 2,
										background: '#1976d2',
									}}
								/>
							</div>
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
							<div
								ref={depthTrackRef}
								className='relative select-none touch-none'
								style={{ height: DRAG_AREA_HEIGHT, minHeight: DRAG_AREA_HEIGHT }}
								onPointerDown={handleDepthPointerDown}
								onPointerMove={handleDepthPointerMove}
								onPointerUp={handleDepthPointerUp}
								onPointerCancel={handleDepthPointerUp}
								onPointerLeave={handleDepthPointerUp}
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
										left: `${((localDepthMin - minDepth) / Math.max(maxDepth - minDepth, 1)) * 100}%`,
										width: `${((localDepthMax - localDepthMin) / Math.max(maxDepth - minDepth, 1)) * 100}%`,
										top: (DRAG_AREA_HEIGHT - TRACK_HEIGHT) / 2,
										height: TRACK_HEIGHT,
									}}
								/>
								<div
									className='absolute rounded-full border-[3px] border-white shadow-[0_1px_4px_rgba(0,0,0,0.2)] pointer-events-none'
									style={{
										width: THUMB_SIZE,
										height: THUMB_SIZE,
										left: `calc(${((localDepthMin - minDepth) / Math.max(maxDepth - minDepth, 1)) * 100}% - ${THUMB_SIZE / 2}px)`,
										top: (DRAG_AREA_HEIGHT - THUMB_SIZE) / 2,
										background: '#1976d2',
									}}
								/>
								<div
									className='absolute rounded-full border-[3px] border-white shadow-[0_1px_4px_rgba(0,0,0,0.2)] pointer-events-none'
									style={{
										width: THUMB_SIZE,
										height: THUMB_SIZE,
										left: `calc(${((localDepthMax - minDepth) / Math.max(maxDepth - minDepth, 1)) * 100}% - ${THUMB_SIZE / 2}px)`,
										top: (DRAG_AREA_HEIGHT - THUMB_SIZE) / 2,
										background: '#1976d2',
									}}
								/>
							</div>
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
