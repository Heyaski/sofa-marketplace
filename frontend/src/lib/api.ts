import axios from 'axios'
import { config } from '../config'

// Базовый URL для API
const API_BASE_URL = config.API_URL

// Создаем экземпляр axios с базовой конфигурацией
export const apiClient = axios.create({
	baseURL: API_BASE_URL,
	headers: {
		'Content-Type': 'application/json',
	},
})

// Интерцептор для добавления токена авторизации
apiClient.interceptors.request.use(
	config => {
		console.log(
			'API Request:',
			config.method?.toUpperCase(),
			config.url,
			config.data
		)
		const token = localStorage.getItem('access_token')
		if (token) {
			config.headers.Authorization = `Bearer ${token}`
		}
		return config
	},
	error => {
		console.error('API Request Error:', error)
		return Promise.reject(error)
	}
)

// Интерцептор для обработки ошибок
apiClient.interceptors.response.use(
	response => {
		console.log(
			'API Response:',
			response.status,
			response.config.url,
			response.data
		)
		return response
	},
	error => {
		console.error(
			'API Response Error:',
			error.response?.status,
			error.response?.data,
			error.config?.url
		)
		if (error.response?.status === 401) {
			// Проверяем, что это не запрос на логин или регистрацию
			const isAuthRequest =
				error.config?.url?.includes('/auth/login/') ||
				error.config?.url?.includes('/users/register/')

			if (!isAuthRequest) {
				// Токен истек, перенаправляем на страницу входа только для защищенных запросов
				localStorage.removeItem('access_token')
				localStorage.removeItem('refresh_token')
				window.location.href = '/login'
			}
		}
		return Promise.reject(error)
	}
)

export default apiClient
