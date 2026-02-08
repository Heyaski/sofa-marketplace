'use client'

import { useState, useEffect } from 'react'

interface RGBColorFilterProps {
	value: string | undefined // rgb "r,g,b" или hex "#rrggbb"
	onChange: (value: string | undefined) => void
	onApply?: () => void
}

// Конвертация hex в rgb строку "r,g,b"
function hexToRgb(hex: string): string | null {
	hex = hex.replace('#', '')
	if (hex.length === 3) {
		hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
	}
	if (hex.length !== 6) return null
	const r = parseInt(hex.slice(0, 2), 16)
	const g = parseInt(hex.slice(2, 4), 16)
	const b = parseInt(hex.slice(4, 6), 16)
	return `${r},${g},${b}`
}

// Конвертация rgb "r,g,b" в hex
function rgbToHex(rgb: string): string {
	const parts = rgb.split(',').map(Number)
	if (parts.length !== 3) return '#0000ff'
	const [r, g, b] = parts.map(v => Math.min(255, Math.max(0, v)))
	return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')
}

export default function RGBColorFilter({
	value,
	onChange,
	onApply,
}: RGBColorFilterProps) {
	const [hexInput, setHexInput] = useState('')
	const [rgbInput, setRgbInput] = useState('')

	useEffect(() => {
		if (value) {
			if (value.startsWith('#')) {
				setHexInput(value)
				const rgb = hexToRgb(value)
				setRgbInput(rgb || '')
			} else {
				setRgbInput(value)
				setHexInput(rgbToHex(value))
			}
		} else {
			setHexInput('#0000ff')
			setRgbInput('0,0,255')
		}
	}, [value])

	const handleColorPickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const hex = e.target.value
		setHexInput(hex)
		const rgb = hexToRgb(hex)
		if (rgb) {
			setRgbInput(rgb)
			onChange(rgb)
		}
	}

	const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const v = e.target.value
		setHexInput(v)
		if (/^#[0-9a-fA-F]{6}$/.test(v) || /^[0-9a-fA-F]{6}$/.test(v)) {
			const hex = v.startsWith('#') ? v : '#' + v
			const rgb = hexToRgb(hex)
			if (rgb) {
				setRgbInput(rgb)
				onChange(rgb)
			}
		}
	}

	const handleRgbInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const v = e.target.value
		setRgbInput(v)
		if (/^\d{1,3},\s*\d{1,3},\s*\d{1,3}$/.test(v)) {
			const parts = v.split(',').map(s => parseInt(s.trim(), 10))
			if (parts.every(p => p >= 0 && p <= 255)) {
				onChange(parts.join(','))
				setHexInput(rgbToHex(parts.join(',')))
			}
		}
	}

	const handleClear = () => {
		onChange(undefined)
		setHexInput('#0000ff')
		setRgbInput('0,0,255')
	}

	return (
		<div className='p-4 space-y-4'>
			<div className='flex items-center gap-3'>
				<div className='relative'>
					<input
						type='color'
						value={hexInput.startsWith('#') ? hexInput : '#0000ff'}
						onChange={handleColorPickerChange}
						className='w-12 h-12 rounded-lg cursor-pointer border border-gray2 p-0'
					/>
				</div>
				<div className='flex-1 space-y-2'>
					<input
						type='text'
						placeholder='#0000ff'
						value={hexInput}
						onChange={handleHexInputChange}
						className='w-full px-3 py-2 border border-gray2 rounded-lg text-sm'
					/>
					<input
						type='text'
						placeholder='R,G,B (0,0,255)'
						value={rgbInput}
						onChange={handleRgbInputChange}
						className='w-full px-3 py-2 border border-gray2 rounded-lg text-sm'
					/>
				</div>
			</div>
			<div className='flex gap-2'>
				{value && (
					<button
						onClick={handleClear}
						className='text-xs text-gray hover:text-black'
					>
						Сбросить
					</button>
				)}
				{onApply && (
					<button
						onClick={onApply}
						className='ml-auto px-4 py-2 bg-main1 text-white rounded-lg text-sm font-medium'
					>
						Применить
					</button>
				)}
			</div>
		</div>
	)
}
