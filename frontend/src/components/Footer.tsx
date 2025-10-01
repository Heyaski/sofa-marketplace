import Image from 'next/image'

export default function Footer() {
	return (
		<footer className='bg-main1 text-white'>
			<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12'>
				<div className='grid md:grid-cols-3 gap-8'>
					{/* Logo and description */}
					<div className='space-y-4'>
						<div className='flex items-center space-x-3'>
							<Image
								src='/img/logo.svg'
								alt='VizHub.art Logo'
								width={32}
								height={32}
								className='w-8 h-8'
							/>
							<span className='text-xl font-bold'>VIZHUB.ART</span>
						</div>
					</div>

					{/* Links */}
					<div className='space-y-4'>
						<div className='space-y-2 text-sm'>
							<a
								href='#'
								className='block hover:text-gray-200 transition-colors'
							>
								Условия предоставления услуг
							</a>
							<a
								href='#'
								className='block hover:text-gray-200 transition-colors'
							>
								Политика Конфиденциальности
							</a>
						</div>
					</div>

					{/* Login/Register Button */}
					<div className='flex justify-end'>
						<button className='bg-white text-main1 px-6 py-3 rounded-lg font-medium hover:bg-gray-100 transition-colors'>
							Войти / Зарегестрироваться
						</button>
					</div>
				</div>

				{/* Divider */}
				<div className='border-t border-main2 mt-8 pt-8'>
					<div className='flex flex-col md:flex-row justify-between items-center text-sm text-gray-200'>
						<div>2025 © Все права защищены</div>
						<div>Настройка файлов cookie</div>
					</div>
				</div>

				{/* Social Media Icons */}
				<div className='flex justify-center mt-8'>
					<div className='flex space-x-4'>
						{/* Instagram */}
						<a
							href='#'
							className='w-10 h-10 rounded-full flex items-center justify-center hover:scale-110 transition-transform'
						>
							<Image
								src='/img/inst.svg'
								alt='Instagram'
								width={40}
								height={40}
								className='w-full h-full'
							/>
						</a>
						{/* WhatsApp */}
						<a
							href='#'
							className='w-10 h-10 rounded-full flex items-center justify-center hover:scale-110 transition-transform'
						>
							<Image
								src='/img/whatsapp.svg'
								alt='WhatsApp'
								width={40}
								height={40}
								className='w-full h-full'
							/>
						</a>
						{/* YouTube */}
						<a
							href='#'
							className='w-10 h-10 rounded-full flex items-center justify-center hover:scale-110 transition-transform'
						>
							<Image
								src='/img/youtube.svg'
								alt='YouTube'
								width={40}
								height={40}
								className='w-full h-full'
							/>
						</a>
						{/* Telegram */}
						<a
							href='#'
							className='w-10 h-10 rounded-full flex items-center justify-center hover:scale-110 transition-transform'
						>
							<Image
								src='/img/telegram.svg'
								alt='Telegram'
								width={40}
								height={40}
								className='w-full h-full'
							/>
						</a>
					</div>
				</div>
			</div>
		</footer>
	)
}
