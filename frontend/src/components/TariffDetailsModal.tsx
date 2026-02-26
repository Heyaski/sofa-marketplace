'use client'

import { subscriptionService } from '@/services/api'
import { Plan } from '@/types'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { useEffect, useState } from 'react'

function formatPrice(value: number | string | null | undefined): string {
	if (value == null || value === '') return '—'
	const num = typeof value === 'string' ? parseFloat(value) : value
	return `${num.toLocaleString('ru-RU')} ₽`
}

function formatMonthlyPrice(plan: Plan): string {
	const p = plan.price
	if (p == null || p === '' || Number(p) === 0) return '0 ₽'
	return `${Number(p).toLocaleString('ru-RU')} ₽`
}

function formatYearlyPrice(plan: Plan): string {
	const perMonth = plan.price_yearly_per_month
	const total = plan.price_yearly
	if (perMonth == null && total == null) return '—'
	if (perMonth != null) {
		const totalVal = total != null ? Number(total) : Number(perMonth) * 12
		return `${Number(perMonth).toLocaleString('ru-RU')} ₽/мес (${Number(totalVal).toLocaleString('ru-RU')} ₽/год)`
	}
	return formatPrice(total)
}

interface TariffDetailsModalProps {
	isOpen: boolean
	onClose: () => void
}

export default function TariffDetailsModal({ isOpen, onClose }: TariffDetailsModalProps) {
	const [plans, setPlans] = useState<Plan[]>([])
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		if (!isOpen) return
		const fetch = async () => {
			setLoading(true)
			try {
				const data = await subscriptionService.getPlans()
				const list = Array.isArray(data) ? data : (data as { results?: Plan[] }).results ?? []
				setPlans(list)
			} catch {
				setPlans([])
			} finally {
				setLoading(false)
			}
		}
		fetch()
	}, [isOpen])

	if (!isOpen) return null

	const headers = [
		'Тариф',
		'Цена помесячно',
		'Цена за год (скидка)',
		'Доступ к Revit-моделям',
		'Доступ к скрипту замены',
		'Доступ к high-poly',
		'Лимиты и особенности',
	]

	return (
		<div
			className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4'
			onClick={onClose}
		>
			<div
				className='bg-white rounded-xl shadow-card max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col'
				onClick={e => e.stopPropagation()}
			>
				<div className='flex items-center justify-between p-4 border-b border-gray2'>
					<h2 className='text-xl font-bold text-black'>Подробное описание тарифов</h2>
					<button
						onClick={onClose}
						className='p-1 text-gray hover:text-black transition-colors'
						aria-label='Закрыть'
					>
						<XMarkIcon className='w-6 h-6' />
					</button>
				</div>
				<div className='overflow-auto p-4'>
					{loading ? (
						<div className='h-48 flex items-center justify-center'>
							<div className='animate-spin rounded-full h-8 w-8 border-b-2 border-main1' />
						</div>
					) : (
						<div className='overflow-x-auto'>
							<table className='w-full min-w-[700px]'>
								<thead>
									<tr className='border-b border-gray2 bg-gray-bg'>
										{headers.map((h) => (
											<th key={h} className='px-3 py-3 text-left text-sm font-semibold text-black'>
												{h}
											</th>
										))}
									</tr>
								</thead>
								<tbody>
									{plans.map((plan, idx) => (
										<tr
											key={plan.id}
											className={`border-b border-gray2 ${idx % 2 === 1 ? 'bg-gray-bg/50' : ''}`}
										>
											<td className='px-3 py-3 font-medium text-black text-sm'>{plan.name}</td>
											<td className='px-3 py-3 text-black text-sm'>{formatMonthlyPrice(plan)}</td>
											<td className='px-3 py-3 text-black text-sm whitespace-nowrap'>
												{formatYearlyPrice(plan)}
											</td>
											<td className='px-3 py-3 text-black text-sm'>{plan.revit_access || '—'}</td>
											<td className='px-3 py-3 text-black text-sm'>{plan.script_access || '—'}</td>
											<td className='px-3 py-3 text-black text-sm'>{plan.highpoly_access || '—'}</td>
											<td className='px-3 py-3 text-black text-sm'>{plan.limits || '—'}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
