'use client'

import { useEffect, useState } from 'react'
import { Product } from '../types'
import { productService } from '../services/api'

interface EditProductModalProps {
	product: Product
	isOpen: boolean
	onClose: () => void
	onSaved: (updated: Product) => void
}

export default function EditProductModal({
	product,
	isOpen,
	onClose,
	onSaved,
}: EditProductModalProps) {
	const [title, setTitle] = useState(product.title || '')
	const [width, setWidth] = useState(product.width != null ? String(product.width) : '')
	const [height, setHeight] = useState(product.height != null ? String(product.height) : '')
	const [depth, setDepth] = useState(product.depth != null ? String(product.depth) : '')
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		if (isOpen) {
			setTitle(product.title || '')
			setWidth(product.width != null ? String(product.width) : '')
			setHeight(product.height != null ? String(product.height) : '')
			setDepth(product.depth != null ? String(product.depth) : '')
			setError(null)
		}
	}, [isOpen, product])

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setError(null)
		setLoading(true)
		try {
			const payload: Partial<Product> = { title }
			const parseNum = (v: string): number | null => {
				if (v === '' || v.trim() === '') return null
				const n = parseFloat(v)
				return isNaN(n) ? null : n
			}
			payload.width = parseNum(width)
			payload.height = parseNum(height)
			payload.depth = parseNum(depth)
			const updated = await productService.updateProduct(product.id, payload)
			onSaved(updated)
			onClose()
		} catch (err: unknown) {
			const msg = err && typeof err === 'object' && 'response' in err
				? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
				: 'Ошибка сохранения'
			setError(typeof msg === 'string' ? msg : 'Ошибка сохранения')
		} finally {
			setLoading(false)
		}
	}

	if (!isOpen) return null

	return (
		<div className='fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50' onClick={onClose}>
			<div
				className='bg-white rounded-xl shadow-xl max-w-md w-full p-6'
				onClick={e => e.stopPropagation()}
			>
				<h2 className='text-xl font-bold text-black mb-4'>Редактировать товар</h2>
				<form onSubmit={handleSubmit} className='space-y-4'>
					<div>
						<label className='block text-sm font-medium text-black mb-1'>Название</label>
						<input
							type='text'
							value={title}
							onChange={e => setTitle(e.target.value)}
							className='w-full px-3 py-2 border border-gray2 rounded-lg focus:ring-2 focus:ring-main1 focus:border-main1'
							required
						/>
					</div>
					<div className='grid grid-cols-3 gap-3'>
						<div>
							<label className='block text-sm font-medium text-black mb-1'>Ширина (см)</label>
							<input
								type='number'
								step='0.1'
								min='0'
								value={width}
								onChange={e => setWidth(e.target.value)}
								className='w-full px-3 py-2 border border-gray2 rounded-lg focus:ring-2 focus:ring-main1'
								placeholder='—'
							/>
						</div>
						<div>
							<label className='block text-sm font-medium text-black mb-1'>Высота (см)</label>
							<input
								type='number'
								step='0.1'
								min='0'
								value={height}
								onChange={e => setHeight(e.target.value)}
								className='w-full px-3 py-2 border border-gray2 rounded-lg focus:ring-2 focus:ring-main1'
								placeholder='—'
							/>
						</div>
						<div>
							<label className='block text-sm font-medium text-black mb-1'>Глубина (см)</label>
							<input
								type='number'
								step='0.1'
								min='0'
								value={depth}
								onChange={e => setDepth(e.target.value)}
								className='w-full px-3 py-2 border border-gray2 rounded-lg focus:ring-2 focus:ring-main1'
								placeholder='—'
							/>
						</div>
					</div>
					{error && <p className='text-sm text-red-500'>{error}</p>}
					<div className='flex gap-3 pt-2'>
						<button
							type='button'
							onClick={onClose}
							className='flex-1 py-2 px-4 rounded-lg border border-gray2 text-black hover:bg-gray-bg'
						>
							Отмена
						</button>
						<button
							type='submit'
							disabled={loading}
							className='flex-1 py-2 px-4 rounded-lg bg-main1 text-white hover:bg-main2 disabled:opacity-50'
						>
							{loading ? 'Сохранение…' : 'Сохранить'}
						</button>
					</div>
				</form>
			</div>
		</div>
	)
}
