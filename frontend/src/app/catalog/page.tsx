'use client'

import CartModal from '@/components/CartModal'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import ProductCard from '@/components/ProductCard'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'

// Mock data for catalog
const catalogProducts = Array.from({ length: 24 }, (_, i) => ({
	id: `catalog-${i + 1}`,
	name: 'Современный диван',
	price: 300000,
	oldPrice: 300000,
	image: '/sofa.jpg',
	formats: ['.fbx', '.glb', '.rfa', '.usdz'],
}))

const categories = [
	{ name: 'Прямые диваны', image: '/img/1.svg' },
	{ name: 'Угловые диваны', image: '/img/2.svg' },
	{ name: 'Кресла', image: '/img/3.svg' },
	{ name: 'Столы обеденные', image: '/img/4.svg' },
	{ name: 'Стулья обеденные', image: '/img/5.svg' },
	{ name: 'Шкафы книжные', image: '/img/6.svg' },
	{ name: 'Тумбы прикроватные', image: '/img/7.svg' },
	{ name: 'Столы письменные', image: '/img/8.svg' },
	{ name: 'Кресла офисные', image: '/img/9.svg' },
	{ name: 'Пуфы', image: '/img/10.svg' },
	{ name: 'Банкетки', image: '/img/11.svg' },
	{ name: 'Барные столы', image: '/img/12.svg' },
	{ name: 'Барные стулья', image: '/img/13.svg' },
	{ name: 'Детские кровати', image: '/img/14.svg' },
	{ name: 'Детские столы', image: '/img/15.svg' },
	{ name: 'Детские стулья', image: '/img/16.svg' },
	{ name: 'Детские шкафы', image: '/img/17.svg' },
]

const subcategories = {
	'Прямые диваны': ['Двухместные', 'Трехместные', 'Модульные'],
	'Угловые диваны': ['П-образные', 'Г-образные', 'С островом'],
	Кресла: ['Офисные', 'Кресла-качалки', 'Кресла-мешки'],
	'Столы обеденные': ['Круглые', 'Прямоугольные', 'Овальные'],
	'Стулья обеденные': ['Деревянные', 'Металлические', 'Пластиковые'],
	'Шкафы книжные': ['Открытые', 'Закрытые', 'Комбинированные'],
	'Тумбы прикроватные': ['С ящиками', 'С полками', 'С дверцами'],
	'Столы письменные': ['Угловые', 'Прямые', 'Модульные'],
	'Кресла офисные': [
		'С подлокотниками',
		'Без подлокотников',
		'С подголовником',
	],
	Пуфы: ['Круглые', 'Квадратные', 'Прямоугольные'],
	Банкетки: ['С ящиками', 'Без ящиков', 'С подушкой'],
	'Барные столы': ['Высокие', 'Средние', 'Низкие'],
	'Барные стулья': ['С подлокотниками', 'Без подлокотников', 'С подставкой'],
	'Детские кровати': ['Односпальные', 'Двуспальные', 'Двухъярусные'],
	'Детские столы': ['Для учебы', 'Игровые', 'Компьютерные'],
	'Детские стулья': ['Регулируемые', 'Обычные', 'С подставкой'],
	'Детские шкафы': ['Для одежды', 'Для игрушек', 'Комбинированные'],
}

export default function CatalogPage() {
	const [isCartModalOpen, setIsCartModalOpen] = useState(false)
	const [selectedProduct, setSelectedProduct] = useState<{
		id: string
		format: string
	} | null>(null)
	const [activeCategory, setActiveCategory] = useState('Прямые диваны')
	const [selectedCategory, setSelectedCategory] = useState('')
	const [priceRange, setPriceRange] = useState([0, 999999])
	const [scrollPosition, setScrollPosition] = useState(0)
	const [hoveredCategory, setHoveredCategory] = useState<string | null>(null)
	const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
	const categoryRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})
	const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)

	const handleAddToCart = (productId: string, format: string) => {
		setSelectedProduct({ id: productId, format })
		setIsCartModalOpen(true)
	}

	const handleCartSelect = (cartId: string) => {
		console.log(
			`Adding product ${selectedProduct?.id} with format ${selectedProduct?.format} to cart ${cartId}`
		)
		setIsCartModalOpen(false)
		setSelectedProduct(null)
	}

	const handleCreateNewCart = (cartName: string) => {
		console.log(`Creating new cart: ${cartName}`)
		setIsCartModalOpen(false)
		setSelectedProduct(null)
	}

	const scrollLeft = () => {
		const container = document.getElementById('categories-slider')
		if (container) {
			container.scrollBy({ left: -200, behavior: 'smooth' })
		}
	}

	const scrollRight = () => {
		const container = document.getElementById('categories-slider')
		if (container) {
			container.scrollBy({ left: 200, behavior: 'smooth' })
		}
	}

	const handleCategoryHover = (
		categoryName: string,
		event: React.MouseEvent
	) => {
		// Очищаем предыдущий таймаут
		if (hoverTimeoutRef.current) {
			clearTimeout(hoverTimeoutRef.current)
		}

		const rect = event.currentTarget.getBoundingClientRect()
		setDropdownPosition({
			top: rect.bottom + window.scrollY + 4,
			left: rect.left + window.scrollX,
		})
		setHoveredCategory(categoryName)
	}

	const handleCategoryLeave = () => {
		// Добавляем задержку перед скрытием dropdown
		hoverTimeoutRef.current = setTimeout(() => {
			setHoveredCategory(null)
		}, 150) // 150ms задержка
	}

	const handleDropdownEnter = () => {
		// Очищаем таймаут при наведении на dropdown
		if (hoverTimeoutRef.current) {
			clearTimeout(hoverTimeoutRef.current)
		}
	}

	const handleDropdownLeave = () => {
		// Скрываем dropdown при уходе с него
		setHoveredCategory(null)
	}

	// Очистка таймаута при размонтировании компонента
	useEffect(() => {
		return () => {
			if (hoverTimeoutRef.current) {
				clearTimeout(hoverTimeoutRef.current)
			}
		}
	}, [])

	return (
		<div className='min-h-screen bg-gray-bg'>
			<Header />

			<main className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 overflow-visible'>
				{/* Breadcrumbs */}
				<div className='mb-6'>
					<nav className='text-sm text-gray'>
						<span>Главная</span>
						<span className='mx-2'>•</span>
						<span className='text-black font-medium'>Каталог</span>
					</nav>
				</div>

				{/* Categories Slider */}
				<div className='mb-8 overflow-visible'>
					<div className='flex items-center space-x-4 overflow-visible'>
						<button
							onClick={scrollLeft}
							className='p-2 rounded-full bg-white hover:bg-gray-100 transition-colors shadow-sm'
						>
							<ChevronLeftIcon className='w-5 h-5 text-gray-600' />
						</button>
						<div
							id='categories-slider'
							className='flex space-x-4 overflow-x-hidden overflow-y-visible flex-1 scrollbar-hide'
							style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
						>
							{categories.map(category => (
								<div
									key={category.name}
									className='relative group flex-shrink-0'
									ref={el => (categoryRefs.current[category.name] = el)}
								>
									<button
										className='whitespace-nowrap px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 bg-white text-black hover:bg-gray2 focus:outline-none'
										onMouseEnter={e => handleCategoryHover(category.name, e)}
										onMouseLeave={handleCategoryLeave}
									>
										<Image
											src={category.image}
											alt={category.name}
											width={20}
											height={20}
											className='w-5 h-5'
										/>
										<span>{category.name}</span>
										<Image
											src='/img/arrow-down.svg'
											alt='Arrow'
											width={16}
											height={16}
											className='w-4 h-4'
										/>
									</button>
								</div>
							))}
						</div>
						<button
							onClick={scrollRight}
							className='p-2 rounded-full bg-white hover:bg-gray-100 transition-colors shadow-sm'
						>
							<ChevronRightIcon className='w-5 h-5 text-gray-600' />
						</button>
					</div>
				</div>

				{/* Catalog Block */}
				<div className='bg-white rounded-xl p-8'>
					{/* Title */}
					<h1 className='text-3xl font-bold text-black mb-8'>Каталог</h1>

					{/* Filters */}
					<div className='flex items-center justify-between mb-4'>
						{/* Left side - Filters */}
						<div className='flex items-center gap-3'>
							<span className='text-black font-medium'>Фильтр</span>

							{/* Price Filter */}
							<select
								className='w-32 px-3 py-2 rounded-lg bg-gray-bg text-black text-sm focus:outline-none focus:ring-2 focus:ring-main1'
								onChange={e =>
									setPriceRange([parseInt(e.target.value), priceRange[1]])
								}
							>
								<option>Цена</option>
							</select>

							<select
								className='w-32 px-3 py-2 rounded-lg bg-gray-bg text-black text-sm focus:outline-none focus:ring-2 focus:ring-main1'
								onChange={e => setSelectedCategory(e.target.value)}
							>
								<option value=''>Категория</option>
								{categories.map(cat => (
									<option key={cat.name} value={cat.name}>
										{cat.name}
									</option>
								))}
							</select>

							{/* Subcategories - only show when category is selected */}
							{selectedCategory &&
								subcategories[
									selectedCategory as keyof typeof subcategories
								] && (
									<select className='w-32 px-3 py-2 rounded-lg bg-gray-bg text-black text-sm focus:outline-none focus:ring-2 focus:ring-main1'>
										<option>Подкатегории</option>
										{subcategories[
											selectedCategory as keyof typeof subcategories
										].map(sub => (
											<option key={sub} value={sub}>
												{sub}
											</option>
										))}
									</select>
								)}

							<select className='w-32 px-3 py-2 rounded-lg bg-gray-bg text-black text-sm focus:outline-none focus:ring-2 focus:ring-main1'>
								<option>Стиль</option>
							</select>
							<select className='w-32 px-3 py-2 rounded-lg bg-gray-bg text-black text-sm focus:outline-none focus:ring-2 focus:ring-main1'>
								<option>Цвет</option>
							</select>
							<select className='w-32 px-3 py-2 rounded-lg bg-gray-bg text-black text-sm focus:outline-none focus:ring-2 focus:ring-main1'>
								<option>Габариты</option>
							</select>
						</div>

						{/* Right side - Sorting */}
						<div className='flex items-center'>
							<span className='text-black font-medium mr-2 text-sm'>
								Сортировка:
							</span>
							<select className='w-40 px-3 py-2 rounded-lg bg-gray-bg text-black text-sm focus:outline-none focus:ring-2 focus:ring-main1'>
								<option>возрастанию цены</option>
							</select>
						</div>
					</div>

					{/* Gray line */}
					<div className='border-t border-gray2 mb-8'></div>

					{/* Products Grid */}
					<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'>
						{catalogProducts.map(product => (
							<ProductCard
								key={product.id}
								{...product}
								onAddToCart={handleAddToCart}
							/>
						))}
					</div>
				</div>
			</main>

			<Footer />

			<CartModal
				isOpen={isCartModalOpen}
				onClose={() => {
					setIsCartModalOpen(false)
					setSelectedProduct(null)
				}}
				onAddToCart={handleCartSelect}
				onCreateNewCart={handleCreateNewCart}
			/>

			{/* Global Dropdown */}
			{hoveredCategory && (
				<div
					className='fixed w-48 bg-white rounded-lg shadow-xl border border-gray-200 z-[9999] transition-all duration-200'
					style={{
						top: `${dropdownPosition.top}px`,
						left: `${dropdownPosition.left}px`,
					}}
					onMouseEnter={handleDropdownEnter}
					onMouseLeave={handleDropdownLeave}
				>
					{subcategories[hoveredCategory as keyof typeof subcategories]?.map(
						sub => (
							<button
								key={sub}
								className='w-full text-left px-4 py-2 text-sm text-black hover:bg-gray-100 first:rounded-t-lg last:rounded-b-lg'
							>
								{sub}
							</button>
						)
					)}
				</div>
			)}
		</div>
	)
}
