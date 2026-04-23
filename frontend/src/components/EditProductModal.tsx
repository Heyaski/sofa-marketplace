'use client'

import { useEffect, useRef, useState } from 'react'
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

	const [glbFile, setGlbFile] = useState<File | null>(null)
	const [ofcFile, setOfcFile] = useState<File | null>(null)
	const [uploadingGlb, setUploadingGlb] = useState(false)
	const [uploadingOfc, setUploadingOfc] = useState(false)
	const [glbStatus, setGlbStatus] = useState<string | null>(null)
	const [ofcStatus, setOfcStatus] = useState<string | null>(null)
	const glbInputRef = useRef<HTMLInputElement>(null)
	const ofcInputRef = useRef<HTMLInputElement>(null)

	useEffect(() => {
		if (isOpen) {
			setTitle(product.title || '')
			setWidth(product.width != null ? String(product.width) : '')
			setHeight(product.height != null ? String(product.height) : '')
			setDepth(product.depth != null ? String(product.depth) : '')
			setError(null)
			setGlbFile(null)
			setOfcFile(null)
			setGlbStatus(null)
			setOfcStatus(null)
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
			let updated = await productService.updateProduct(product.id, payload)

			if (glbFile) {
				setUploadingGlb(true)
				try {
					updated = await productService.uploadProductModel(product.id, glbFile, 'glb')
					setGlbStatus('Загружено')
				} catch {
					setGlbStatus('Ошибка загрузки GLB')
				} finally {
					setUploadingGlb(false)
				}
			}
			if (ofcFile) {
				setUploadingOfc(true)
				try {
					updated = await productService.uploadProductModel(product.id, ofcFile, 'ofc')
					setOfcStatus('Загружено')
				} catch {
					setOfcStatus('Ошибка загрузки файла')
				} finally {
					setUploadingOfc(false)
				}
			}

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

	const isUploading = uploadingGlb || uploadingOfc

	if (!isOpen) return null

	return (
		<div className='fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50' onClick={onClose}>
			<div
				className='bg-white rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto'
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

					{/* GLB file upload */}
					<div>
						<label className='block text-sm font-medium text-black mb-1'>GLB модель</label>
						{product.model_glb && (
							<p className='text-xs text-gray mb-1 truncate' title={product.model_glb}>
								Текущий: {product.model_glb.split('/').pop()}
							</p>
						)}
						<div className='flex items-center gap-2'>
							<input
								ref={glbInputRef}
								type='file'
								accept='.glb'
								className='hidden'
								onChange={e => {
									const f = e.target.files?.[0] || null
									setGlbFile(f)
									setGlbStatus(null)
								}}
							/>
							<button
								type='button'
								onClick={() => glbInputRef.current?.click()}
								disabled={uploadingGlb}
								className='px-3 py-2 text-sm border border-gray2 rounded-lg hover:bg-gray-bg transition-colors flex-shrink-0'
							>
								{glbFile ? 'Заменить' : product.model_glb ? 'Заменить GLB' : 'Загрузить GLB'}
							</button>
							{glbFile && (
								<span className='text-xs text-black truncate'>{glbFile.name}</span>
							)}
							{uploadingGlb && (
								<span className='text-xs text-gray'>Загрузка…</span>
							)}
							{glbStatus && (
								<span className={`text-xs ${glbStatus === 'Загружено' ? 'text-green-600' : 'text-red-500'}`}>
									{glbStatus}
								</span>
							)}
						</div>
					</div>

					{/* Secondary model file upload */}
					<div>
						<label className='block text-sm font-medium text-black mb-1'>Файл модели</label>
						{product.model_rfa && (
							<p className='text-xs text-gray mb-1 truncate' title={product.model_rfa}>
								Текущий: {product.model_rfa.split('/').pop()}
							</p>
						)}
						<div className='flex items-center gap-2'>
							<input
								ref={ofcInputRef}
								type='file'
								accept='.ofc,.rfa'
								className='hidden'
								onChange={e => {
									const f = e.target.files?.[0] || null
									setOfcFile(f)
									setOfcStatus(null)
								}}
							/>
							<button
								type='button'
								onClick={() => ofcInputRef.current?.click()}
								disabled={uploadingOfc}
								className='px-3 py-2 text-sm border border-gray2 rounded-lg hover:bg-gray-bg transition-colors flex-shrink-0'
							>
								{ofcFile ? 'Заменить' : product.model_rfa ? 'Заменить файл' : 'Загрузить файл'}
							</button>
							{ofcFile && (
								<span className='text-xs text-black truncate'>{ofcFile.name}</span>
							)}
							{uploadingOfc && (
								<span className='text-xs text-gray'>Загрузка…</span>
							)}
							{ofcStatus && (
								<span className={`text-xs ${ofcStatus === 'Загружено' ? 'text-green-600' : 'text-red-500'}`}>
									{ofcStatus}
								</span>
							)}
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
							disabled={loading || isUploading}
							className='flex-1 py-2 px-4 rounded-lg bg-main1 text-white hover:bg-main2 disabled:opacity-50'
						>
							{loading || isUploading ? 'Сохранение…' : 'Сохранить'}
						</button>
					</div>
				</form>
			</div>
		</div>
	)
}
