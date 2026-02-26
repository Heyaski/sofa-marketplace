'use client'

import { subscriptionService } from '@/services/api'
import { Plan } from '@/types'
import { useEffect, useState } from 'react'
import Link from 'next/link'

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

export default function TariffTable() {
	const [plans, setPlans] = useState<Plan[]>([])
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		const fetch = async () => {
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
	}, [])

	if (loading) {
		return (
			<div className='bg-white rounded-xl p-8 shadow-card'>
				<div className='animate-pulse h-64 bg-gray-bg rounded-lg' />
			</div>
		)
	}

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
		<section className='py-12 lg:py-16'>
			<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
				<h2 className='text-2xl sm:text-3xl font-bold text-black mb-8'>Тарифы</h2>
				<div className='bg-white rounded-xl shadow-card overflow-hidden'>
					<div className='overflow-x-auto'>
						<table className='w-full min-w-[800px]'>
							<thead>
								<tr className='border-b border-gray2 bg-gray-bg'>
									{headers.map((h) => (
										<th key={h} className='px-4 py-4 text-left text-sm font-semibold text-black'>
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
										<td className='px-4 py-4 font-medium text-black'>{plan.name}</td>
										<td className='px-4 py-4 text-black'>{formatMonthlyPrice(plan)}</td>
										<td className='px-4 py-4 text-black whitespace-nowrap'>
											{formatYearlyPrice(plan)}
										</td>
										<td className='px-4 py-4 text-black text-sm'>{plan.revit_access || '—'}</td>
										<td className='px-4 py-4 text-black text-sm'>{plan.script_access || '—'}</td>
										<td className='px-4 py-4 text-black text-sm'>{plan.highpoly_access || '—'}</td>
										<td className='px-4 py-4 text-black text-sm'>{plan.limits || '—'}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
				<div className='mt-6 text-center'>
					<Link
						href='/profile/subscription'
						className='inline-block bg-main1 text-white px-6 py-3 rounded-lg font-medium hover:bg-main2 transition-colors'
					>
						Выбрать тариф
					</Link>
				</div>
			</div>
		</section>
	)
}
