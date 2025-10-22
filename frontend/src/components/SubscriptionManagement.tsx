'use client'

import Image from 'next/image'
import { useState } from 'react'

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
		isCurrent: true,
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
	const [selectedPlan, setSelectedPlan] = useState<string>('trial')

	const handleSelectPlan = (planId: string) => {
		setSelectedPlan(planId)
		// Здесь будет логика для обновления подписки через API
		console.log('Selected plan:', planId)
	}

	return (
		<div className='bg-white rounded-xl p-8 shadow-card min-h-[600px]'>
			<div className='mb-8'>
				<h1 className='text-3xl font-bold text-black'>Управление подпиской</h1>
			</div>

			<div className='bg-white rounded-xl overflow-hidden'>
				<div className='grid grid-cols-1 md:grid-cols-3 divide-x divide-gray-300'>
					{subscriptionPlans.map(plan => (
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
									plan.isCurrent
										? 'bg-gray text-white cursor-not-allowed'
										: 'bg-main1 text-white'
								}`}
								disabled={plan.isCurrent}
							>
								{plan.isCurrent ? 'Выбрано' : 'Выбрать'}
							</button>
						</div>
					))}
				</div>
			</div>
		</div>
	)
}
