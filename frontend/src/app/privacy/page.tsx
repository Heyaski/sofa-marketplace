'use client'

import { useEffect, useState } from 'react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { pageService } from '@/services/api'
import { StaticPage } from '@/types'

export default function PrivacyPage() {
	const [page, setPage] = useState<StaticPage | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	const loadPage = async () => {
		try {
			setLoading(true)
			setError(null)
			// Добавляем timestamp для предотвращения кеширования
			const data = await pageService.getPageByType('privacy')
			setPage(data)
		} catch (err: any) {
			console.error('Ошибка загрузки страницы:', err)
			setError(err.response?.data?.detail || 'Не удалось загрузить страницу')
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		loadPage()
	}, [])

	// Обновляем страницу при возврате фокуса (когда пользователь возвращается на вкладку)
	useEffect(() => {
		const handleFocus = () => {
			loadPage()
		}
		window.addEventListener('focus', handleFocus)
		return () => {
			window.removeEventListener('focus', handleFocus)
		}
	}, [])

	if (loading) {
		return (
			<div className='min-h-screen bg-gray-bg'>
				<Header />
				<main className='max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12'>
					<div className='bg-white rounded-lg shadow-sm p-8 md:p-12'>
						<div className='text-center text-gray-600'>Загрузка...</div>
					</div>
				</main>
				<Footer />
			</div>
		)
	}

	if (error || !page) {
		return (
			<div className='min-h-screen bg-gray-bg'>
				<Header />
				<main className='max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12'>
					<div className='bg-white rounded-lg shadow-sm p-8 md:p-12'>
						<div className='text-center text-red-600 mb-4'>
							{error || 'Страница не найдена'}
						</div>
						<button
							onClick={loadPage}
							className='mx-auto block px-4 py-2 bg-main1 text-white rounded hover:bg-main1/90'
						>
							Обновить страницу
						</button>
					</div>
				</main>
				<Footer />
			</div>
		)
	}

	return (
		<div className='min-h-screen bg-gray-bg'>
			<Header />
			<main className='max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12'>
				<div className='bg-white rounded-lg shadow-sm p-8 md:p-12'>
					<div className='flex justify-between items-center mb-8'>
						<h1 className='text-3xl md:text-4xl font-bold text-gray-900'>
							{page.title}
						</h1>
						<button
							onClick={loadPage}
							disabled={loading}
							className='px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed'
							title='Обновить контент страницы'
						>
							{loading ? 'Обновление...' : '🔄 Обновить'}
						</button>
					</div>
					<div 
						className='prose prose-lg max-w-none text-gray-700 space-y-8'
						dangerouslySetInnerHTML={{ __html: page.content }}
					/>
				</div>
			</main>
			<Footer />
		</div>
	)
}

