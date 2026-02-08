'use client'

import { XMarkIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
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
	const [isLoginMode, setIsLoginMode] = useState(true)
	const [showPassword, setShowPassword] = useState(false)
	const [showPasswordConfirm, setShowPasswordConfirm] = useState(false)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	// Поля для входа
	const [loginEmail, setLoginEmail] = useState('')
	const [loginPassword, setLoginPassword] = useState('')

	// Поля для регистрации
	const [registerEmail, setRegisterEmail] = useState('')
	const [registerPassword, setRegisterPassword] = useState('')
	const [registerPasswordConfirm, setRegisterPasswordConfirm] = useState('')
	const [registerUsername, setRegisterUsername] = useState('')

	if (!isOpen) return null

	const resetForm = () => {
		setLoginEmail('')
		setLoginPassword('')
		setRegisterEmail('')
		setRegisterPassword('')
		setRegisterPasswordConfirm('')
		setRegisterUsername('')
		setError(null)
		setShowPassword(false)
		setShowPasswordConfirm(false)
	}

	const handleModeSwitch = (mode: boolean) => {
		setIsLoginMode(mode)
		resetForm()
	}

	const handleLogin = async (e?: React.FormEvent) => {
		if (e) e.preventDefault()
		setLoading(true)
		setError(null)

		if (!loginEmail || !loginPassword) {
			setError('Заполните все поля')
			setLoading(false)
			return
		}

		try {
			const tokens = await authService.login({
				username: loginEmail,
				password: loginPassword,
			})
			localStorage.setItem('access_token', tokens.access)
			localStorage.setItem('refresh_token', tokens.refresh)
			onSuccess?.()
			onClose()
			resetForm()
		} catch (err: any) {
			console.error('Login error:', err)
			const errorMessage =
				err.response?.data?.detail || 'Неверный логин или пароль'
			setError(errorMessage)
		} finally {
			setLoading(false)
		}
	}

	const handleRegister = async (e: React.FormEvent) => {
		e.preventDefault()
		setLoading(true)
		setError(null)

		// Валидация
		if (!registerEmail || !registerPassword || !registerPasswordConfirm) {
			setError('Заполните все поля')
			setLoading(false)
			return
		}

		if (registerPassword.length < 8) {
			setError('Пароль должен содержать минимум 8 символов')
			setLoading(false)
			return
		}

		if (registerPassword !== registerPasswordConfirm) {
			setError('Пароли не совпадают')
			setLoading(false)
			return
		}

		try {
			// Генерируем username из email, если не указан
			const username = registerUsername || (registerEmail.includes('@')
				? registerEmail.split('@')[0]
				: registerEmail.replace(/[^a-zA-Z0-9]/g, '_'))

			const userData = await authService.register({
				username,
				email: registerEmail,
				password: registerPassword,
				password_confirm: registerPasswordConfirm,
				first_name: '',
				last_name: '',
			})

			// После успешной регистрации автоматически логинимся
			const tokens = await authService.login({
				username: username,
				password: registerPassword,
			})
			localStorage.setItem('access_token', tokens.access)
			localStorage.setItem('refresh_token', tokens.refresh)
			onSuccess?.()
			onClose()
			resetForm()
		} catch (err: any) {
			console.error('Register error:', err)
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

			<div className='flex min-h-full items-end sm:items-center justify-center p-0 sm:p-4'>
				<div className='relative bg-white rounded-t-xl sm:rounded-xl shadow-xl max-w-md w-full sm:max-h-[90vh] overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-0'>
					<button
						onClick={onClose}
						className='absolute top-4 right-4 text-gray hover:text-black transition-colors z-10'
					>
						<XMarkIcon className='w-6 h-6' />
					</button>

					<div className='p-4 sm:p-6 lg:p-8'>
						{/* Табы для переключения между входом и регистрацией */}
						<div className='flex mb-6 bg-gray-bg rounded-lg p-1'>
							<button
								type='button'
								onClick={() => handleModeSwitch(true)}
								className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
									isLoginMode
										? 'bg-white text-main1 shadow-sm'
										: 'text-gray hover:text-black'
								}`}
							>
								Вход
							</button>
							<button
								type='button'
								onClick={() => handleModeSwitch(false)}
								className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
									!isLoginMode
										? 'bg-white text-main1 shadow-sm'
										: 'text-gray hover:text-black'
								}`}
							>
								Регистрация
							</button>
						</div>

						<h2 className='text-2xl font-bold text-black mb-6 text-center'>
							{isLoginMode ? 'Вход в аккаунт' : 'Создать аккаунт'}
						</h2>

						{error && (
							<div className='mb-4 p-3 bg-red-50 border border-red-200 rounded-lg'>
								<p className='text-red-600 text-sm'>{error}</p>
							</div>
						)}

						{isLoginMode ? (
							// Форма входа
							<form onSubmit={handleLogin} className='space-y-4'>
								<div>
									<input
										type='text'
										placeholder='E-mail или логин'
										value={loginEmail}
										onChange={e => setLoginEmail(e.target.value)}
										className='w-full px-4 py-3 bg-gray-bg border border-gray2 rounded-lg focus:outline-none focus:ring-2 focus:ring-main1 focus:border-transparent'
										required
									/>
								</div>

								<div className='relative'>
									<input
										type={showPassword ? 'text' : 'password'}
										placeholder='Пароль'
										value={loginPassword}
										onChange={e => setLoginPassword(e.target.value)}
										className='w-full px-4 py-3 bg-gray-bg border border-gray2 rounded-lg focus:outline-none focus:ring-2 focus:ring-main1 focus:border-transparent pr-10'
										required
									/>
									<button
										type='button'
										onClick={() => setShowPassword(!showPassword)}
										className='absolute right-3 top-1/2 -translate-y-1/2 text-gray hover:text-black'
									>
										{showPassword ? (
											<EyeSlashIcon className='w-5 h-5' />
										) : (
											<EyeIcon className='w-5 h-5' />
										)}
									</button>
								</div>

								<button
									type='submit'
									disabled={loading}
									className='w-full bg-main1 text-white py-3 rounded-lg font-medium hover:bg-main2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
								>
									{loading ? 'Вход...' : 'Войти'}
								</button>
							</form>
						) : (
							// Форма регистрации
							<form onSubmit={handleRegister} className='space-y-4'>
								<div>
									<input
										type='email'
										placeholder='E-mail'
										value={registerEmail}
										onChange={e => setRegisterEmail(e.target.value)}
										className='w-full px-4 py-3 bg-gray-bg border border-gray2 rounded-lg focus:outline-none focus:ring-2 focus:ring-main1 focus:border-transparent'
										required
									/>
								</div>

								<div>
									<input
										type='text'
										placeholder='Логин (необязательно)'
										value={registerUsername}
										onChange={e => setRegisterUsername(e.target.value)}
										className='w-full px-4 py-3 bg-gray-bg border border-gray2 rounded-lg focus:outline-none focus:ring-2 focus:ring-main1 focus:border-transparent'
									/>
									<p className='text-xs text-gray mt-1'>
										Если не указан, будет создан автоматически
									</p>
								</div>

								<div className='relative'>
									<input
										type={showPassword ? 'text' : 'password'}
										placeholder='Пароль'
										value={registerPassword}
										onChange={e => setRegisterPassword(e.target.value)}
										className='w-full px-4 py-3 bg-gray-bg border border-gray2 rounded-lg focus:outline-none focus:ring-2 focus:ring-main1 focus:border-transparent pr-10'
										required
									/>
									<button
										type='button'
										onClick={() => setShowPassword(!showPassword)}
										className='absolute right-3 top-1/2 -translate-y-1/2 text-gray hover:text-black'
									>
										{showPassword ? (
											<EyeSlashIcon className='w-5 h-5' />
										) : (
											<EyeIcon className='w-5 h-5' />
										)}
									</button>
								</div>

								<div className='relative'>
									<input
										type={showPasswordConfirm ? 'text' : 'password'}
										placeholder='Подтвердите пароль'
										value={registerPasswordConfirm}
										onChange={e => setRegisterPasswordConfirm(e.target.value)}
										className='w-full px-4 py-3 bg-gray-bg border border-gray2 rounded-lg focus:outline-none focus:ring-2 focus:ring-main1 focus:border-transparent pr-10'
										required
									/>
									<button
										type='button'
										onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
										className='absolute right-3 top-1/2 -translate-y-1/2 text-gray hover:text-black'
									>
										{showPasswordConfirm ? (
											<EyeSlashIcon className='w-5 h-5' />
										) : (
											<EyeIcon className='w-5 h-5' />
										)}
									</button>
								</div>

								<button
									type='submit'
									disabled={loading}
									className='w-full bg-main1 text-white py-3 rounded-lg font-medium hover:bg-main2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
								>
									{loading ? 'Регистрация...' : 'Зарегистрироваться'}
								</button>
							</form>
						)}

						{/* Разделитель с социальными сетями */}
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

						{/* Кнопки социальных сетей */}
						<div className='grid grid-cols-3 gap-3'>
							<button
								type='button'
								className='flex flex-col items-center justify-center px-3 py-3 border-2 border-gray2 rounded-lg hover:bg-gray-bg transition-colors'
							>
								<span className='text-xl font-bold text-blue-600'>ВК</span>
								<span className='text-xs text-black mt-1'>ВКонтакте</span>
							</button>
							<button
								type='button'
								className='flex flex-col items-center justify-center px-3 py-3 border-2 border-gray2 rounded-lg hover:bg-gray-bg transition-colors'
							>
								<span className='text-xl font-bold text-orange-500'>@</span>
								<span className='text-xs text-black mt-1'>Mail.ru</span>
							</button>
							<button
								type='button'
								className='flex flex-col items-center justify-center px-3 py-3 border-2 border-gray2 rounded-lg hover:bg-gray-bg transition-colors'
							>
								<span className='text-xl font-bold text-red-500'>Я</span>
								<span className='text-xs text-black mt-1'>Яндекс</span>
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
