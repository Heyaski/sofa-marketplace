'use client'

import { authService } from '@/services/api'
import { User } from '@/types'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import PaymentModal from './PaymentModal'

interface SubscriptionPlan {
	id: string
	name: string
	price: string
	features: string
	image: string
	isSelected?: boolean
	isCurrent?: boolean
}

const subscriptionPlans: SubscriptionPlan[] = [
	{
		id: 'trial',
		name: 'Пробная',
		price: 'БЕСПЛАТНО',
		features: 'Пробное скачивание 3-х моделей',
		image: '/img/test_subscriptions.svg',
	},
	{
		id: 'basic',
		name: 'Базовая',
		price: '1 000 руб/мес',
		features: '10 скачиваний в месяц',
		image: '/img/base_subscriptions.svg',
	},
	{
		id: 'premium',
		name: 'Премиум',
		price: '8 000 руб/мес',
		features: 'Безлимитное скачивание моделей',
		image: '/img/premium_subscriptions.svg',
	},
]

export default function SubscriptionManagement() {
	const [user, setUser] = useState<User | null>(null)
	const [loading, setLoading] = useState(true)
	const [selectedPlan, setSelectedPlan] = useState<string>('trial')
	const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
	const [selectedPlanForPayment, setSelectedPlanForPayment] = useState<{
		id: string
		name: string
		price: string
	} | null>(null)

	// Загружаем данные пользователя при монтировании компонента
	useEffect(() => {
		const fetchUser = async () => {
			try {
				const userData = await authService.getCurrentUser()
				setUser(userData)
				// Устанавливаем текущую подписку из данных пользователя
				if (userData.profile?.subscription_type) {
					setSelectedPlan(userData.profile.subscription_type)
				}
			} catch (error) {
				console.error('Ошибка при загрузке пользователя:', error)
			} finally {
				setLoading(false)
			}
		}

		fetchUser()
	}, [])

	// Определяем текущую подписку пользователя
	const currentSubscription = user?.profile?.subscription_type || 'trial'

	const handleSelectPlan = (planId: string) => {
		const plan = subscriptionPlans.find(p => p.id === planId)
		// Проверяем, что план существует и не является текущим
		if (plan && planId !== currentSubscription) {
			setSelectedPlanForPayment({
				id: plan.id,
				name: plan.name,
				price: plan.price,
			})
			setIsPaymentModalOpen(true)
		}
	}

	const handlePaymentSuccess = async () => {
		// После успешной оплаты обновляем данные пользователя
		try {
			const userData = await authService.getCurrentUser()
			setUser(userData)
			if (userData.profile?.subscription_type) {
				setSelectedPlan(userData.profile.subscription_type)
			}
		} catch (error) {
			console.error('Ошибка при обновлении данных пользователя:', error)
		}
		// Закрываем модальное окно оплаты
		setIsPaymentModalOpen(false)
		setSelectedPlanForPayment(null)
		console.log('Payment successful for plan:', selectedPlanForPayment)
	}

	return (
		<div className='bg-white rounded-xl p-8 shadow-card min-h-[600px]'>
			<div className='mb-8'>
				<h1 className='text-3xl font-bold text-black'>Управление подпиской</h1>
			</div>

			{loading ? (
				<div className='flex items-center justify-center h-64'>
					<div className='animate-spin rounded-full h-8 w-8 border-b-2 border-main1'></div>
				</div>
			) : (
				<div className='bg-white rounded-xl overflow-hidden'>
					<div className='grid grid-cols-1 md:grid-cols-3 divide-x divide-gray-300'>
						{subscriptionPlans.map(plan => {
							const isCurrent = plan.id === currentSubscription
							return (
								<div key={plan.id} className='p-6 text-center flex flex-col'>
									{/* Название плана */}
									<h3 className='text-xl font-semibold text-black mb-4'>
										{plan.name}
									</h3>

									{/* Изображение плана */}
									<div className='mb-4'>
										<div className='w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden mx-auto'>
											<Image
												src={plan.image}
												alt={plan.name}
												width={100}
												height={100}
												className='w-full h-full object-contain'
											/>
										</div>
									</div>

									{/* Цена */}
									<div className='mb-4'>
										<span className='text-2xl text-black'>{plan.price}</span>
									</div>

									{/* Описание функций */}
									<p className='text-black text-sm mb-6 flex-grow'>
										{plan.features}
									</p>

									{/* Кнопка выбора */}
									<button
										onClick={() => handleSelectPlan(plan.id)}
										className={`w-full py-3 px-4 rounded-lg font-medium ${
											isCurrent
												? 'bg-gray text-white cursor-not-allowed'
												: 'bg-main1 text-white hover:bg-main2'
										}`}
										disabled={isCurrent}
									>
										{isCurrent ? 'Выбрано' : 'Выбрать'}
									</button>
								</div>
							)
						})}
					</div>
				</div>
			)}

			{/* Payment Modal */}
			{selectedPlanForPayment && (
				<PaymentModal
					isOpen={isPaymentModalOpen}
					onClose={() => {
						setIsPaymentModalOpen(false)
						setSelectedPlanForPayment(null)
					}}
					onPaymentSuccess={handlePaymentSuccess}
					planName={selectedPlanForPayment.name}
					planPrice={selectedPlanForPayment.price}
					planId={selectedPlanForPayment.id}
				/>
			)}
		</div>
	)
}
