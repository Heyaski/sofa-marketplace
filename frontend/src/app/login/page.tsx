'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function LoginPage() {
	const router = useRouter()

	useEffect(() => {
		// Редирект на главную страницу, т.к. авторизация теперь через модальное окно
		router.push('/')
	}, [router])

	return null
}
