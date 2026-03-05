'use client'

import { XMarkIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'
import { basketService } from '@/services/api'

interface CommercialProposalModalProps {
	isOpen: boolean
	onClose: () => void
	basketId: number
	basketName: string
	userName?: string
	userEmail?: string
}

export default function CommercialProposalModal({
	isOpen,
	onClose,
	basketId,
	basketName,
	userName,
	userEmail,
}: CommercialProposalModalProps) {
	const [clientName, setClientName] = useState(userName || '')
	const [companyName, setCompanyName] = useState('')
	const [email, setEmail] = useState(userEmail || '')
	const [telegram, setTelegram] = useState('')
	const [deliveryMethod, setDeliveryMethod] = useState<'email' | 'telegram'>('email')
	const [projectName, setProjectName] = useState(basketName || '')
	const [loading, setLoading] = useState(false)
	const [success, setSuccess] = useState(false)
	const [error, setError] = useState('')
	const [pdfUrl, setPdfUrl] = useState<string | null>(null)
	const [docxUrl, setDocxUrl] = useState<string | null>(null)

	if (!isOpen) return null

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setError('')
		setLoading(true)

		try {
			const result = await basketService.generateCommercialProposal(basketId, {
				client_name: clientName,
				company_name: companyName,
				email: deliveryMethod === 'email' ? email : '',
				telegram: deliveryMethod === 'telegram' ? telegram : '',
				delivery_method: deliveryMethod,
				project_name: projectName || basketName,
				basket_id: basketId,
			})

			setSuccess(true)
			setPdfUrl(result.pdf_url || null)
			setDocxUrl(result.docx_url || null)
		} catch (err: any) {
			console.error('Ошибка генерации КП:', err)
			const errorMessage =
				err.response?.data?.error ||
				err.response?.data?.detail ||
				(typeof err.response?.data === 'object'
					? Object.values(err.response?.data || {}).flat().join(', ')
					: '') ||
				'Произошла ошибка при генерации коммерческого предложения'
			setError(errorMessage)
		} finally {
			setLoading(false)
		}
	}

	const handleClose = () => {
		setSuccess(false)
		setError('')
		setPdfUrl(null)
		setDocxUrl(null)
		onClose()
	}

	return (
		<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'>
			<div className='bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl'>
				{/* Header */}
				<div className='flex items-center justify-between p-5 border-b border-gray2'>
					<h2 className='text-lg font-bold text-black'>
						Подобрать аналоги в продаже
					</h2>
					<button
						onClick={handleClose}
						className='text-gray hover:text-black transition-colors'
					>
						<XMarkIcon className='w-6 h-6' />
					</button>
				</div>

				{success ? (
					/* Успешное состояние */
					<div className='p-6 text-center'>
						<div className='w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center'>
							<svg
								className='w-8 h-8 text-green-500'
								fill='none'
								stroke='currentColor'
								viewBox='0 0 24 24'
							>
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									strokeWidth={2}
									d='M5 13l4 4L19 7'
								/>
							</svg>
						</div>
						<h3 className='text-xl font-bold text-black mb-2'>
							КП сформировано!
						</h3>
						<p className='text-gray mb-4'>
							{deliveryMethod === 'email'
								? `Коммерческое предложение отправлено на ${email}`
								: `Коммерческое предложение отправлено в Telegram`}
						</p>
						<div className='flex flex-col items-center gap-2 mb-3'>
							{pdfUrl && (
								<a
									href={pdfUrl}
									download='КП.pdf'
									target='_blank'
									rel='noopener noreferrer'
									className='inline-block bg-main1 text-white px-6 py-2 rounded-lg hover:bg-main2 transition-colors font-medium'
								>
									Скачать PDF
								</a>
							)}
						{docxUrl && (
							<a
								href={docxUrl}
								download='КП.docx'
								target='_blank'
								rel='noopener noreferrer'
								className='inline-block bg-main1 text-white px-6 py-2 rounded-lg hover:bg-main2 transition-colors font-medium'
							>
								Скачать DOCX
							</a>
						)}
						</div>
						<div>
							<button
								onClick={handleClose}
								className='text-gray hover:text-black transition-colors text-sm'
							>
								Закрыть
							</button>
						</div>
					</div>
				) : (
					/* Форма */
					<form onSubmit={handleSubmit} className='p-5 space-y-4'>
						<p className='text-sm text-gray'>
							Мы сформируем коммерческое предложение с аналогами товаров из
							вашей корзины и отправим его удобным для вас способом.
						</p>

						{error && (
							<div className='p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm'>
								{error}
							</div>
						)}

						{/* Имя клиента */}
						<div>
							<label className='block text-sm font-medium text-black mb-1'>
								Ваше имя <span className='text-red-500'>*</span>
							</label>
							<input
								type='text'
								value={clientName}
								onChange={(e) => setClientName(e.target.value)}
								placeholder='Иванов Иван Иванович'
								className='w-full px-4 py-2.5 border border-gray2 rounded-lg focus:outline-none focus:ring-2 focus:ring-main1/30 focus:border-main1 text-sm'
								required
							/>
						</div>

						{/* Название компании/студии */}
						<div>
							<label className='block text-sm font-medium text-black mb-1'>
								Название компании / студии
							</label>
							<input
								type='text'
								value={companyName}
								onChange={(e) => setCompanyName(e.target.value)}
								placeholder='Студия дизайна «Пример», vizhub.pro'
								className='w-full px-4 py-2.5 border border-gray2 rounded-lg focus:outline-none focus:ring-2 focus:ring-main1/30 focus:border-main1 text-sm'
							/>
						</div>

						{/* Название проекта */}
						<div>
							<label className='block text-sm font-medium text-black mb-1'>
								Название проекта
							</label>
							<input
								type='text'
								value={projectName}
								onChange={(e) => setProjectName(e.target.value)}
								placeholder='3х комн. Светланская 102'
								className='w-full px-4 py-2.5 border border-gray2 rounded-lg focus:outline-none focus:ring-2 focus:ring-main1/30 focus:border-main1 text-sm'
							/>
						</div>

						{/* Способ отправки */}
						<div>
							<label className='block text-sm font-medium text-black mb-2'>
								Способ получения КП <span className='text-red-500'>*</span>
							</label>
							<div className='flex gap-3'>
								<button
									type='button'
									onClick={() => setDeliveryMethod('email')}
									className={`flex-1 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
										deliveryMethod === 'email'
											? 'bg-main1 text-white border-main1'
											: 'bg-white text-black border-gray2 hover:border-main1'
									}`}
								>
									📧 Email
								</button>
								<button
									type='button'
									onClick={() => setDeliveryMethod('telegram')}
									className={`flex-1 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
										deliveryMethod === 'telegram'
											? 'bg-main1 text-white border-main1'
											: 'bg-white text-black border-gray2 hover:border-main1'
									}`}
								>
									✈️ Telegram
								</button>
							</div>
						</div>

						{/* Email */}
						{deliveryMethod === 'email' && (
							<div>
								<label className='block text-sm font-medium text-black mb-1'>
									Email <span className='text-red-500'>*</span>
								</label>
								<input
									type='email'
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									placeholder='example@mail.ru'
									className='w-full px-4 py-2.5 border border-gray2 rounded-lg focus:outline-none focus:ring-2 focus:ring-main1/30 focus:border-main1 text-sm'
									required={deliveryMethod === 'email'}
								/>
							</div>
						)}

						{/* Telegram */}
						{deliveryMethod === 'telegram' && (
							<div>
								<label className='block text-sm font-medium text-black mb-1'>
									Telegram ID или username{' '}
									<span className='text-red-500'>*</span>
								</label>
								<input
									type='text'
									value={telegram}
									onChange={(e) => setTelegram(e.target.value)}
									placeholder='@username или числовой ID'
									className='w-full px-4 py-2.5 border border-gray2 rounded-lg focus:outline-none focus:ring-2 focus:ring-main1/30 focus:border-main1 text-sm'
									required={deliveryMethod === 'telegram'}
								/>
								<p className='mt-1 text-xs text-gray'>
									Для отправки в Telegram укажите ваш числовой Chat ID.
									Его можно узнать у бота @userinfobot
								</p>
							</div>
						)}

						{/* Кнопка отправки */}
						<button
							type='submit'
							disabled={loading}
							className='w-full bg-main1 text-white py-3 rounded-lg hover:bg-main2 transition-colors font-medium text-base disabled:opacity-50 disabled:cursor-not-allowed'
						>
							{loading ? (
								<span className='flex items-center justify-center gap-2'>
									<svg
										className='animate-spin h-5 w-5 text-white'
										xmlns='http://www.w3.org/2000/svg'
										fill='none'
										viewBox='0 0 24 24'
									>
										<circle
											className='opacity-25'
											cx='12'
											cy='12'
											r='10'
											stroke='currentColor'
											strokeWidth='4'
										></circle>
										<path
											className='opacity-75'
											fill='currentColor'
											d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
										></path>
									</svg>
									Формируем КП...
								</span>
							) : (
								'Получить коммерческое предложение'
							)}
						</button>

						<p className='text-xs text-gray text-center'>
							Нажимая кнопку, вы соглашаетесь на обработку персональных данных
						</p>
					</form>
				)}
			</div>
		</div>
	)
}
