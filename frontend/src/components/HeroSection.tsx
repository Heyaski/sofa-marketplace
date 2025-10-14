'use client'

import Image from 'next/image'

export default function HeroSection() {
	return (
		<section className='bg-white py-16 lg:py-24'>
			<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
				<div className='grid lg:grid-cols-[1fr_1.2fr] gap-16 items-center'>
					{/* Left content */}
					<div className='space-y-8 max-w-lg'>
						<h1 className='text-4xl lg:text-3xl font-bold text-black leading-tight'>
							Реалистичная мебель в 3D — для интерьеров, которые хочется трогать
						</h1>

						<p className='text-lg text-black leading-relaxed'>
							Готовые модели реальной мебели для быстрого и эффектного
							проектирования интерьеров. Точность, стиль и готовность к рендеру
							— сразу после загрузки.
						</p>

						<div className='pt-4'>
							<button className='bg-main1 text-white px-8 py-4 rounded-lg text-lg font-medium hover:bg-main2 transition-colors'>
								Зарегестрироваться бесплатно
							</button>
						</div>
					</div>

					{/* Right image - 3D Sofa */}
					<div className='relative'>
						<Image
							src='/img/hero-image.jpg'
							alt='3D модель современного дивана с разрезом'
							width={1200}
							height={900}
							className='w-full h-auto object-cover scale-125'
							priority
						/>
					</div>
				</div>
			</div>
		</section>
	)
}
