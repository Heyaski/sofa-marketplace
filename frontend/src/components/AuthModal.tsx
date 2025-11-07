'use client'

import { XMarkIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'
import { authService } from '../services/api'

interface AuthModalProps {
	isOpen: boolean
	onClose: () => void
	onSuccess?: () => void
}

export default function AuthModal({
	isOpen,
	onClose,
	onSuccess,
}: AuthModalProps) {
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	if (!isOpen) return null

	const handleLogin = async () => {
		setLoading(true)
		setError(null)

		try {
			const tokens = await authService.login({
				username: email,
				password,
			})
			localStorage.setItem('access_token', tokens.access)
			localStorage.setItem('refresh_token', tokens.refresh)
			onSuccess?.()
			onClose()
		} catch (err: any) {
			console.error('Login error:', err)
			const errorMessage =
				err.response?.data?.detail || 'Неверный логин или пароль'
			setError(errorMessage)
		} finally {
			setLoading(false)
		}
	}

	const handleRegister = async (e: React.MouseEvent) => {
		e.preventDefault()
		setLoading(true)
		setError(null)

		try {
			// Генерируем username из email, если email валидный
			const username = email.includes('@')
				? email.split('@')[0]
				: email.replace(/[^a-zA-Z0-9]/g, '_')

			// Проверяем минимальную длину пароля
			if (password.length < 8) {
				setError('Пароль должен содержать минимум 8 символов')
				setLoading(false)
				return
			}

			const userData = await authService.register({
				username,
				email,
				password,
				password_confirm: password,
				first_name: '',
				last_name: '',
			})

			// После успешной регистрации автоматически логинимся
			// Используем username, а не email для логина
			const tokens = await authService.login({
				username: username,
				password,
			})
			localStorage.setItem('access_token', tokens.access)
			localStorage.setItem('refresh_token', tokens.refresh)
			onSuccess?.()
			onClose()
		} catch (err: any) {
			console.error('Register error:', err)
			// Показываем более детальную ошибку
			const errorData = err.response?.data
			let errorMessage = 'Ошибка при регистрации'

			if (errorData) {
				if (typeof errorData === 'string') {
					errorMessage = errorData
				} else if (errorData.detail) {
					errorMessage = errorData.detail
				} else if (errorData.non_field_errors) {
					errorMessage = errorData.non_field_errors[0]
				} else {
					// Показываем первую ошибку из объекта
					const firstError = Object.values(errorData)[0]
					if (Array.isArray(firstError)) {
						errorMessage = firstError[0]
					} else if (typeof firstError === 'string') {
						errorMessage = firstError
					}
				}
			}
			setError(errorMessage)
		} finally {
			setLoading(false)
		}
	}

	return (
		<div className='fixed inset-0 z-50 overflow-y-auto'>
			<div
				className='fixed inset-0 bg-black bg-opacity-50'
				onClick={onClose}
			></div>

			<div className='flex min-h-full items-center justify-center p-4'>
				<div className='relative bg-white rounded-lg shadow-xl max-w-2xl w-full'>
					<button
						onClick={onClose}
						className='absolute top-4 right-4 text-gray hover:text-black transition-colors'
					>
						<XMarkIcon className='w-6 h-6' />
					</button>

					<div className='p-8'>
						<h2 className='text-2xl font-bold text-black mb-6'>
							Вход / регистрация
						</h2>

						{error && (
							<div className='mb-4 p-3 bg-red-50 border border-red-200 rounded-lg'>
								<p className='text-red-600 text-sm'>{error}</p>
							</div>
						)}

						<div className='space-y-4'>
							<input
								type='text'
								placeholder='e-mail или логин'
								value={email}
								onChange={e => setEmail(e.target.value)}
								onKeyDown={e => {
									if (e.key === 'Enter') {
										e.preventDefault()
										handleLogin()
									}
								}}
								className='w-full px-4 py-3 bg-gray-bg border border-gray2 rounded-lg focus:outline-none focus:ring-2 focus:ring-main1'
								required
							/>

							<input
								type='password'
								placeholder='Пароль'
								value={password}
								onChange={e => setPassword(e.target.value)}
								onKeyDown={e => {
									if (e.key === 'Enter') {
										e.preventDefault()
										handleLogin()
									}
								}}
								className='w-full px-4 py-3 bg-gray-bg border border-gray2 rounded-lg focus:outline-none focus:ring-2 focus:ring-main1'
								required
							/>

							<div className='relative my-6'>
								<div className='absolute inset-0 flex items-center'>
									<div className='w-full border-t border-gray2'></div>
								</div>
								<div className='relative flex justify-center text-sm'>
									<span className='px-2 bg-white text-gray'>
										Войти с помощью
									</span>
								</div>
							</div>

							<div className='grid grid-cols-2 gap-4'>
								<button
									type='button'
									className='flex items-center justify-center px-4 py-3 border-2 border-gray2 rounded-lg hover:bg-gray-bg transition-colors'
								>
									<span className='text-2xl font-bold text-blue-500'>G</span>
									<span className='ml-2 text-black'>Google</span>
								</button>
								<button
									type='button'
									className='flex items-center justify-center px-4 py-3 border-2 border-gray2 rounded-lg hover:bg-gray-bg transition-colors'
								>
									<span className='text-2xl font-bold text-red-500'>Я</span>
									<span className='ml-2 text-black'>Яндекс</span>
								</button>
							</div>

							<button
								type='button'
								onClick={handleRegister}
								disabled={loading}
								className='mx-auto block px-12 bg-main1 text-white py-3 rounded-lg font-medium hover:bg-main2 transition-colors disabled:opacity-50'
							>
								{loading ? 'Загрузка...' : 'Зарегестрироваться'}
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
