'use client'

import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'
import { authService } from '../services/api'
import { LoginCredentials, RegisterData } from '../types'

interface AuthFormProps {
	onSuccess?: () => void
}

function AuthForm({ onSuccess }: AuthFormProps) {
	const [isLogin, setIsLogin] = useState(true)
	const [showPassword, setShowPassword] = useState(false)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	// Состояние для формы входа
	const [loginData, setLoginData] = useState<LoginCredentials>({
		username: '',
		password: '',
	})

	// Состояние для формы регистрации
	const [registerData, setRegisterData] = useState<RegisterData>({
		username: '',
		email: '',
		password: '',
		password_confirm: '',
		first_name: '',
		last_name: '',
	})

	const handleLogin = async (e: React.FormEvent) => {
		e.preventDefault()
		setLoading(true)
		setError(null)

		// Валидация на фронтенде
		if (!loginData.username || !loginData.password) {
			setError('Логин и пароль обязательны')
			setLoading(false)
			return
		}

		try {
			const tokens = await authService.login(loginData)
			localStorage.setItem('access_token', tokens.access)
			localStorage.setItem('refresh_token', tokens.refresh)
			onSuccess?.()
		} catch (err) {
			console.error('Login error:', err)
			if (err && typeof err === 'object' && 'response' in err) {
				// Ошибка от API
				const apiError = err as any
				if (apiError.response?.data) {
					const errorData = apiError.response.data
					if (typeof errorData === 'string') {
						setError(errorData)
					} else if (errorData.detail) {
						setError(errorData.detail)
					} else if (errorData.non_field_errors) {
						setError(errorData.non_field_errors[0])
					} else if (errorData.username) {
						setError(
							`Логин: ${
								Array.isArray(errorData.username)
									? errorData.username[0]
									: errorData.username
							}`
						)
					} else if (errorData.password) {
						setError(
							`Пароль: ${
								Array.isArray(errorData.password)
									? errorData.password[0]
									: errorData.password
							}`
						)
					} else {
						setError('Неверный логин или пароль')
					}
				} else {
					setError(
						'Ошибка подключения к серверу. Проверьте интернет-соединение.'
					)
				}
			} else if (err instanceof Error) {
				setError(err.message)
			} else {
				setError('Произошла неизвестная ошибка. Попробуйте еще раз.')
			}
		} finally {
			setLoading(false)
		}
	}

	const handleRegister = async (e: React.FormEvent) => {
		e.preventDefault()
		setLoading(true)
		setError(null)

		// Валидация на фронтенде
		if (
			!registerData.username ||
			!registerData.email ||
			!registerData.password ||
			!registerData.password_confirm
		) {
			setError('Все поля обязательны для заполнения')
			setLoading(false)
			return
		}

		if (registerData.password !== registerData.password_confirm) {
			setError('Пароли не совпадают')
			setLoading(false)
			return
		}

		if (registerData.password.length < 8) {
			setError('Пароль должен содержать минимум 8 символов')
			setLoading(false)
			return
		}

		try {
			await authService.register(registerData)
			setError(null)
			// После успешной регистрации переключаемся на форму входа
			setIsLogin(true)
		} catch (err) {
			console.error('Registration error:', err)
			if (err instanceof Error) {
				setError(err.message)
			} else if (err && typeof err === 'object' && 'response' in err) {
				// Ошибка от API
				const apiError = err as any
				if (apiError.response?.data) {
					const errorData = apiError.response.data
					if (typeof errorData === 'string') {
						setError(errorData)
					} else if (errorData.detail) {
						setError(errorData.detail)
					} else if (errorData.non_field_errors) {
						setError(errorData.non_field_errors[0])
					} else {
						// Показываем первую ошибку из объекта
						const firstError = Object.values(errorData)[0]
						if (Array.isArray(firstError)) {
							setError(firstError[0] as string)
						} else {
							setError(firstError as string)
						}
					}
				} else {
					setError('Ошибка при регистрации. Попробуйте еще раз.')
				}
			} else {
				setError('Ошибка при регистрации. Попробуйте еще раз.')
			}
		} finally {
			setLoading(false)
		}
	}

	return (
		<div className='min-h-screen bg-gray-bg flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8'>
			<div className='max-w-md w-full space-y-8'>
				{/* Header */}
				<div className='text-center'>
					<h2 className='text-3xl font-bold text-black'>
						{isLogin ? 'Вход в аккаунт' : 'Регистрация'}
					</h2>
					<p className='mt-2 text-gray'>
						{isLogin
							? 'Войдите в свой аккаунт для доступа к каталогу'
							: 'Создайте новый аккаунт для начала работы'}
					</p>
				</div>

				{/* Form */}
				<div className='bg-white rounded-xl p-8 shadow-card'>
					{error && (
						<div className='mb-4 p-3 bg-red-50 border border-red-200 rounded-lg'>
							<p className='text-red-600 text-sm'>{error}</p>
						</div>
					)}

					{isLogin ? (
						<form onSubmit={handleLogin} className='space-y-6'>
							<div>
								<label
									htmlFor='username'
									className='block text-sm font-medium text-black mb-2'
								>
									Логин
								</label>
								<input
									id='username'
									name='username'
									type='text'
									required
									value={loginData.username}
									onChange={e =>
										setLoginData({ ...loginData, username: e.target.value })
									}
									className='input-field'
									placeholder='Введите логин'
								/>
							</div>

							<div>
								<label
									htmlFor='password'
									className='block text-sm font-medium text-black mb-2'
								>
									Пароль
								</label>
								<div className='relative'>
									<input
										id='password'
										name='password'
										type={showPassword ? 'text' : 'password'}
										required
										value={loginData.password}
										onChange={e =>
											setLoginData({ ...loginData, password: e.target.value })
										}
										className='input-field pr-10'
										placeholder='Введите пароль'
									/>
									<button
										type='button'
										className='absolute inset-y-0 right-0 pr-3 flex items-center'
										onClick={() => setShowPassword(!showPassword)}
									>
										{showPassword ? (
											<EyeSlashIcon className='h-5 w-5 text-gray' />
										) : (
											<EyeIcon className='h-5 w-5 text-gray' />
										)}
									</button>
								</div>
							</div>

							<div className='flex items-center justify-between'>
								<div className='flex items-center'>
									<input
										id='remember-me'
										name='remember-me'
										type='checkbox'
										className='h-4 w-4 text-main1 focus:ring-main1 border-gray2 rounded'
									/>
									<label
										htmlFor='remember-me'
										className='ml-2 block text-sm text-gray'
									>
										Запомнить меня
									</label>
								</div>

								<div className='text-sm'>
									<a href='#' className='text-main1 hover:text-main2'>
										Забыли пароль?
									</a>
								</div>
							</div>

							<button
								type='submit'
								disabled={loading}
								className='w-full btn-primary py-3 disabled:opacity-50 disabled:cursor-not-allowed'
							>
								{loading ? 'Вход...' : 'Войти'}
							</button>
						</form>
					) : (
						<form onSubmit={handleRegister} className='space-y-6'>
							<div className='grid grid-cols-2 gap-4'>
								<div>
									<label
										htmlFor='first_name'
										className='block text-sm font-medium text-black mb-2'
									>
										Имя
									</label>
									<input
										id='first_name'
										name='first_name'
										type='text'
										required
										value={registerData.first_name}
										onChange={e =>
											setRegisterData({
												...registerData,
												first_name: e.target.value,
											})
										}
										className='input-field'
										placeholder='Имя'
									/>
								</div>
								<div>
									<label
										htmlFor='last_name'
										className='block text-sm font-medium text-black mb-2'
									>
										Фамилия
									</label>
									<input
										id='last_name'
										name='last_name'
										type='text'
										required
										value={registerData.last_name}
										onChange={e =>
											setRegisterData({
												...registerData,
												last_name: e.target.value,
											})
										}
										className='input-field'
										placeholder='Фамилия'
									/>
								</div>
							</div>

							<div>
								<label
									htmlFor='email'
									className='block text-sm font-medium text-black mb-2'
								>
									Email
								</label>
								<input
									id='email'
									name='email'
									type='email'
									required
									value={registerData.email}
									onChange={e =>
										setRegisterData({ ...registerData, email: e.target.value })
									}
									className='input-field'
									placeholder='example@email.com'
								/>
							</div>

							<div>
								<label
									htmlFor='reg_username'
									className='block text-sm font-medium text-black mb-2'
								>
									Логин
								</label>
								<input
									id='reg_username'
									name='username'
									type='text'
									required
									value={registerData.username}
									onChange={e =>
										setRegisterData({
											...registerData,
											username: e.target.value,
										})
									}
									className='input-field'
									placeholder='Введите логин'
								/>
							</div>

							<div>
								<label
									htmlFor='reg_password'
									className='block text-sm font-medium text-black mb-2'
								>
									Пароль
								</label>
								<div className='relative'>
									<input
										id='reg_password'
										name='password'
										type={showPassword ? 'text' : 'password'}
										required
										value={registerData.password}
										onChange={e =>
											setRegisterData({
												...registerData,
												password: e.target.value,
											})
										}
										className='input-field pr-10'
										placeholder='Введите пароль'
									/>
									<button
										type='button'
										className='absolute inset-y-0 right-0 pr-3 flex items-center'
										onClick={() => setShowPassword(!showPassword)}
									>
										{showPassword ? (
											<EyeSlashIcon className='h-5 w-5 text-gray' />
										) : (
											<EyeIcon className='h-5 w-5 text-gray' />
										)}
									</button>
								</div>
							</div>

							<div>
								<label
									htmlFor='reg_password_confirm'
									className='block text-sm font-medium text-black mb-2'
								>
									Подтверждение пароля
								</label>
								<input
									id='reg_password_confirm'
									name='password_confirm'
									type='password'
									required
									value={registerData.password_confirm}
									onChange={e =>
										setRegisterData({
											...registerData,
											password_confirm: e.target.value,
										})
									}
									className='input-field'
									placeholder='Подтвердите пароль'
								/>
							</div>

							<div className='flex items-center'>
								<input
									id='terms'
									name='terms'
									type='checkbox'
									required
									className='h-4 w-4 text-main1 focus:ring-main1 border-gray2 rounded'
								/>
								<label htmlFor='terms' className='ml-2 block text-sm text-gray'>
									Я согласен с{' '}
									<a href='#' className='text-main1 hover:text-main2'>
										условиями использования
									</a>
								</label>
							</div>

							<button
								type='submit'
								disabled={loading}
								className='w-full btn-primary py-3 disabled:opacity-50 disabled:cursor-not-allowed'
							>
								{loading ? 'Регистрация...' : 'Зарегистрироваться'}
							</button>
						</form>
					)}

					{/* Switch between login/register */}
					<div className='mt-6 text-center'>
						<p className='text-sm text-gray'>
							{isLogin ? 'Нет аккаунта?' : 'Уже есть аккаунт?'}{' '}
							<button
								type='button'
								onClick={() => {
									setIsLogin(!isLogin)
									setError(null)
								}}
								className='text-main1 hover:text-main2 font-medium'
							>
								{isLogin ? 'Зарегистрироваться' : 'Войти'}
							</button>
						</p>
					</div>
				</div>

				{/* Footer */}
				<div className='text-center'>
					<p className='text-xs text-gray'>
						© 2024 VizHub.art. Все права защищены.
					</p>
				</div>
			</div>
		</div>
	)
}

export default AuthForm
