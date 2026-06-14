'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { clearUserMeCache } from '@/lib/userMeCache'

function AuthCallbackContent() {
	const router = useRouter()
	const searchParams = useSearchParams()
	const [message, setMessage] = useState('Завершаем вход...')

	useEffect(() => {
		const error = searchParams.get('error')
		if (error) {
			setMessage(decodeURIComponent(error))
			return
		}

		const access = searchParams.get('access')
		const refresh = searchParams.get('refresh')
		if (access && refresh) {
			localStorage.setItem('access_token', access)
			localStorage.setItem('refresh_token', refresh)
			clearUserMeCache()
			const next = searchParams.get('next') || '/'
			router.replace(next)
			return
		}

		setMessage('Не удалось войти. Попробуйте снова.')
	}, [searchParams, router])

	return (
		<div className='min-h-screen flex items-center justify-center px-4'>
			<p className='text-center text-gray-700'>{message}</p>
		</div>
	)
}

export default function AuthCallbackPage() {
	return (
		<Suspense
			fallback={
				<div className='min-h-screen flex items-center justify-center px-4'>
					<p className='text-center text-gray-700'>Завершаем вход...</p>
				</div>
			}
		>
			<AuthCallbackContent />
		</Suspense>
	)
}
