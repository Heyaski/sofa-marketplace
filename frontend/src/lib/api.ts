import axios from 'axios'
import { config } from '../config'

// Базовый URL для API
const API_BASE_URL = config.API_URL

// Создаем экземпляр axios с базовой конфигурации
export const apiClient = axios.create({
	baseURL: API_BASE_URL,
	headers: {
		'Content-Type': 'application/json',
	},
})

/** Запрос refresh без интерцепторов apiClient — иначе цикл. */
const rawAuthClient = axios.create({
	baseURL: API_BASE_URL,
	headers: { 'Content-Type': 'application/json' },
})

let refreshInFlight: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
	if (refreshInFlight) return refreshInFlight
	const refresh = localStorage.getItem('refresh_token')
	if (!refresh) return null

	refreshInFlight = (async () => {
		try {
			const { data } = await rawAuthClient.post<{ access: string; refresh?: string }>(
				'/api/auth/refresh/',
				{ refresh }
			)
			if (data?.access) {
				localStorage.setItem('access_token', data.access)
				if (data.refresh) localStorage.setItem('refresh_token', data.refresh)
				return data.access
			}
			return null
		} catch {
			localStorage.removeItem('access_token')
			localStorage.removeItem('refresh_token')
			return null
		} finally {
			refreshInFlight = null
		}
	})()

	return refreshInFlight
}

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

// Интерцептор: при истечении access — обновить через refresh и повторить запрос
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

		const originalRequest = error.config
		const status = error.response?.status

		if (status !== 401 || !originalRequest) {
			return Promise.reject(error)
		}

		const url = String(originalRequest.url || '')
		if (
			url.includes('/api/auth/login/') ||
			url.includes('/api/auth/refresh/') ||
			url.includes('/users/register/')
		) {
			return Promise.reject(error)
		}

		const req = originalRequest as typeof originalRequest & { _authRetry?: boolean }

		if (req._authRetry) {
			localStorage.removeItem('access_token')
			localStorage.removeItem('refresh_token')
			return Promise.reject(error)
		}
		req._authRetry = true

		return refreshAccessToken().then(token => {
			if (!token) {
				return Promise.reject(error)
			}
			req.headers.Authorization = `Bearer ${token}`
			return apiClient(req)
		})
	}
)

export default apiClient