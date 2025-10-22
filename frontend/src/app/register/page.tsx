'use client'

import { useRouter } from 'next/navigation'
import AuthForm from '../../components/AuthForm'

export default function RegisterPage() {
	const router = useRouter()

	const handleAuthSuccess = () => {
		// После успешной регистрации перенаправляем на главную страницу
		router.push('/')
	}

	return (
		<div className='min-h-screen bg-gray-bg'>
			<AuthForm onSuccess={handleAuthSuccess} />
		</div>
	)
}
