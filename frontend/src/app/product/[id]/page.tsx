'use client'

import AuthModal from '@/components/AuthModal'
import BottomNav from '@/components/BottomNav'
import CartModal from '@/components/CartModal'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import ProductModelViewer, { getProductModelUrlAt } from '@/components/ProductModelViewer'
import RfaModelViewer from '@/components/RfaModelViewer'
import { getProductPrimaryImageUrl } from '@/utils/productImage'
import { hasDownloadableRfa } from '@/utils/productModelFiles'
import { config } from '@/config'
import { formatDimension } from '@/utils/format'
import { getTitleWithoutBrand } from '@/utils/productTitle'
import { useBaskets, useProduct } from '@/hooks/useApi'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface ProductPageProps {
	params: {
		id: string
	}
}

export default function ProductPage({ params }: ProductPageProps) {
	const router = useRouter()
	const productId = parseInt(params.id)
	const [isCartModalOpen, setIsCartModalOpen] = useState(false)
	const selectedFormat = config.DEFAULT_FORMAT
	const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
	const [isSuperuser, setIsSuperuser] = useState(false)
	const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
	const [toastMessage, setToastMessage] = useState<string | null>(null)

	const { product, loading, error } = useProduct(productId)
	const { createBasket, addToBasket } = useBaskets()

	useEffect(() => {
		if (!toastMessage) return
		const t = setTimeout(() => setToastMessage(null), 3000)
		return () => clearTimeout(t)
	}, [toastMessage])

	useEffect(() => {
		const token = localStorage.getItem('access_token')
		if (token) {
			import('@/services/api').then(({ authService }) =>
				authService.getCurrentUser()
					.then((user) => {
						setIsAuthenticated(true)
						setIsSuperuser(!!user.is_superuser)
					})
					.catch(() => setIsAuthenticated(false))
			)
		} else {
			setIsAuthenticated(false)
		}
	}, [])

	const handleAddToCart = () => {
		if (isAuthenticated === false) {
			setIsAuthModalOpen(true)
			return
		}
		setIsCartModalOpen(true)
	}

	const handleCartSelect = async (cartId: number) => {
		if (product) {
			try {
				await addToBasket(cartId, product.id, 1, selectedFormat)
			} catch (error) {
				console.error('Ошибка при добавлении в корзину:', error)
			}
		}
		setIsCartModalOpen(false)
	}

	const handleCreateNewCart = async (cartName: string) => {
		try {
			const newBasket = await createBasket(cartName)
			if (product) {
				await addToBasket(newBasket.id, product.id, 1, selectedFormat)
			}
		} catch (error) {
			console.error('Ошибка при создании корзины:', error)
		}
		setIsCartModalOpen(false)
	}

	const handleDownloadModel = async () => {
		if (!product) {
			setToastMessage('Товар еще загружается')
			return
		}
		if (isAuthenticated === false) {
			setIsAuthModalOpen(true)
			return
		}
		if (!hasDownloadableRfa(product)) {
			setToastMessage('У этой модели нет файла .rfa')
			return
		}
		try {
			const token = localStorage.getItem('access_token')
			const response = await fetch(
				`${config.API_URL}/api/downloads/presign/`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: token ? `Bearer ${token}` : '',
					},
					body: JSON.stringify({
						product_id: product.id,
						format: '.rfa',
					}),
				}
			)

			const contentType = response.headers.get('content-type')
			const isJson = contentType && contentType.includes('application/json')
			const data = isJson ? await response.json() : null

			if (!response.ok) {
				if (response.status === 401) {
					setIsAuthModalOpen(true)
					return
				}
				const message =
					data?.error ||
					data?.detail ||
					data?.message ||
					'Ошибка при получении ссылки для скачивания файла'
				alert(message)
				return
			}

			if (data?.url) {
				window.location.href = data.url
			} else {
				setToastMessage('Файл модели недоступен для этого товара')
			}
		} catch (error) {
			console.error('Ошибка при скачивании файла модели:', error)
			alert('Ошибка при скачивании файла модели')
		}
	}

	if (loading) {
		return (
			<div className='min-h-screen bg-gray-bg'>
				<Header />
				<main className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
					<div className='text-center py-12'>Загрузка...</div>
				</main>
			</div>
		)
	}

	if (error || !product) {
		return (
			<div className='min-h-screen bg-gray-bg'>
				<Header />
				<main className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
					<div className='text-center py-12 text-red-500'>
						Ошибка загрузки товара: {error || 'Товар не найден'}
					</div>
				</main>
			</div>
		)
	}

	const productImageUrl = getProductPrimaryImageUrl(product)
	const firstModelUrl = getProductModelUrlAt(product, 0)

	return (
		<div className='min-h-screen bg-gray-bg'>
			<Header />

			<main className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 pb-20 lg:pb-8'>
				{/* Хлебные крошки */}
				<div className='mb-4 sm:mb-6 lg:mb-8'>
					<nav className='text-xs sm:text-sm text-gray'>
						<span
							className='cursor-pointer hover:text-black'
							onClick={() => router.push('/')}
						>
							Главная
						</span>
						<span className='mx-2'>•</span>
						<span
							className='cursor-pointer hover:text-black'
							onClick={() => router.push('/catalog')}
						>
							Каталог
						</span>
						<span className='mx-2'>•</span>
						<span className='text-black font-medium'>Страница товара</span>
					</nav>
				</div>

				<div className='bg-white rounded-xl p-4 sm:p-6 lg:p-8 shadow-card'>
					<div className='grid lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8'>
						<div className='space-y-3'>
							<div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
								<div className='bg-gray-bg rounded-lg overflow-hidden relative min-h-[180px] max-h-[300px]'>
									{isSuperuser && product.model_3d_id && firstModelUrl && (
										<span className='absolute left-2 top-2 z-10 text-xs text-gray font-medium bg-white/80 px-2 py-1 rounded'>
											{product.model_3d_id}
										</span>
									)}
									{firstModelUrl ? (
										<ProductModelViewer
											product={product}
											variant='page'
											modelIndex={0}
											compact
										/>
									) : productImageUrl ? (
										// eslint-disable-next-line @next/next/no-img-element
										<img
											src={productImageUrl}
											alt={product.title_display ?? getTitleWithoutBrand(product.title || '', product.brand)}
											className='w-full h-full object-cover min-h-[180px] max-h-[300px]'
										/>
									) : (
										<div className='min-h-[180px] flex items-center justify-center text-xs text-gray px-2 text-center'>
											Нет 3D-модели
										</div>
									)}
								</div>
								<RfaModelViewer product={product} onDownload={handleDownloadModel} />
							</div>
						</div>

			{/* Информация о товаре */}
			<div className='space-y-3 sm:space-y-4'>
							<h1 className='text-lg sm:text-xl lg:text-2xl font-bold text-black'>
								{product.title_display ?? getTitleWithoutBrand(product.title || '', product.brand)}
							</h1>

							{/* Описание */}
							{product.description && (
								<div className='prose max-w-none max-h-[min(40vh,280px)] overflow-y-auto pr-1'>
									<p className='text-black leading-relaxed text-xs sm:text-sm'>
										{product.description}
									</p>
								</div>
							)}

							{/* Размеры (без веса) */}
							{(product.width || product.height || product.depth) && (
								<div className='space-y-2 text-sm'>
									<div className='text-sm font-medium text-black'>Размеры:</div>
									<div className='grid grid-cols-2 gap-2 text-sm'>
										{product.width != null && (
											<div className='flex justify-between'>
												<span className='text-gray'>Ширина:</span>
												<span className='text-black'>{formatDimension(product.width)} см</span>
											</div>
										)}
										{product.height != null && (
											<div className='flex justify-between'>
												<span className='text-gray'>Высота:</span>
												<span className='text-black'>{formatDimension(product.height)} см</span>
											</div>
										)}
										{product.depth != null && (
											<div className='flex justify-between'>
												<span className='text-gray'>Глубина:</span>
												<span className='text-black'>{formatDimension(product.depth)} см</span>
											</div>
										)}
									</div>
								</div>
							)}

							{/* Основные действия */}
							<div className='grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 relative'>
								<button
									onClick={handleAddToCart}
									className='bg-main1 text-white py-2.5 sm:py-3 rounded-lg hover:bg-main1/90 transition-colors font-medium text-sm sm:text-base'
								>
									В корзину
								</button>
								<button
									onClick={handleDownloadModel}
									className='border-2 border-main1 bg-white text-main1 py-2.5 sm:py-3 rounded-lg hover:bg-main1 hover:text-white transition-colors text-sm sm:text-base'
								>
									Скачать файл
								</button>
								{toastMessage && (
									<div className='fixed left-1/2 bottom-8 -translate-x-1/2 px-4 py-3 text-sm rounded-lg shadow-xl z-[9999]' style={{ backgroundColor: '#1a1a1a', color: '#ffffff' }}>
										{toastMessage}
									</div>
								)}
							</div>

							{/* Ссылка на вход/регистрацию - только для неавторизованных */}
							{isAuthenticated === false && (
								<div className='text-sm text-gray text-center'>
									<button
										className='hover:text-black transition-colors cursor-pointer'
										onClick={() => setIsAuthModalOpen(true)}
									>
										Войти / Зарегистрироваться
									</button>
								</div>
							)}
						</div>
					</div>
				</div>
			</main>

			<Footer />
			<BottomNav />

			<CartModal
				isOpen={isCartModalOpen}
				onClose={() => setIsCartModalOpen(false)}
				onAddToCart={handleCartSelect}
				onCreateNewCart={handleCreateNewCart}
			/>

			<AuthModal
				isOpen={isAuthModalOpen}
				onClose={() => setIsAuthModalOpen(false)}
				onSuccess={() => {
					setIsAuthenticated(true)
					setIsAuthModalOpen(false)
					window.dispatchEvent(new Event('auth-updated'))
				}}
			/>
		</div>
	)
}
