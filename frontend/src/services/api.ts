import apiClient from '../lib/api'
import {
	ApiResponse,
	AuthTokens,
	Basket,
	Category,
	Chat,
	Download,
	LoginCredentials,
	Message,
	Order,
	Plan,
	Product,
	ProductFilters,
	RegisterData,
	Subscription,
	User,
} from '../types'

// Сервис для работы с продуктами
export const productService = {
	// Получить все продукты с фильтрацией
	getProducts: async (
		filters?: ProductFilters
	): Promise<ApiResponse<Product>> => {
		const params = new URLSearchParams()

		if (filters) {
			Object.entries(filters).forEach(([key, value]) => {
				if (value !== undefined && value !== null && value !== '') {
					params.append(key, value.toString())
				}
			})
		}

		const response = await apiClient.get(`/api/products/?${params.toString()}`)
		return response.data
	},

	// Получить продукт по ID
	getProduct: async (id: number): Promise<Product> => {
		const response = await apiClient.get(`/api/products/${id}/`)
		return response.data
	},

	// Создать продукт (только для админов)
	createProduct: async (product: Partial<Product>): Promise<Product> => {
		const response = await apiClient.post('/api/products/', product)
		return response.data
	},

	// Обновить продукт (только для админов)
	updateProduct: async (
		id: number,
		product: Partial<Product>
	): Promise<Product> => {
		const response = await apiClient.put(`/api/products/${id}/`, product)
		return response.data
	},

	// Удалить продукт (только для админов)
	deleteProduct: async (id: number): Promise<void> => {
		await apiClient.delete(`/api/products/${id}/`)
	},
}

// Сервис для работы с категориями
export const categoryService = {
	// Получить все категории
	getCategories: async (): Promise<ApiResponse<Category>> => {
		const response = await apiClient.get('/api/categories/')
		return response.data
	},

	// Получить категорию по ID
	getCategory: async (id: number): Promise<Category> => {
		const response = await apiClient.get(`/api/categories/${id}/`)
		return response.data
	},

	// Создать категорию (только для админов)
	createCategory: async (category: Partial<Category>): Promise<Category> => {
		const response = await apiClient.post('/api/categories/', category)
		return response.data
	},

	// Обновить категорию (только для админов)
	updateCategory: async (
		id: number,
		category: Partial<Category>
	): Promise<Category> => {
		const response = await apiClient.put(`/api/categories/${id}/`, category)
		return response.data
	},

	// Удалить категорию (только для админов)
	deleteCategory: async (id: number): Promise<void> => {
		await apiClient.delete(`/api/categories/${id}/`)
	},
}

// Сервис для работы с корзинами
export const basketService = {
	// Получить все корзины пользователя
	getBaskets: async (): Promise<ApiResponse<Basket>> => {
		const response = await apiClient.get('/api/baskets/')
		return response.data
	},

	// Получить корзину по ID
	getBasket: async (id: number): Promise<Basket> => {
		const response = await apiClient.get(`/api/baskets/${id}/`)
		return response.data
	},

	// ✅ Создать новую корзину
	createBasket: async (name: string): Promise<Basket> => {
		const response = await apiClient.post('/api/baskets/', { name })
		return response.data
	},

	// ✅ Добавить товар в корзину через action add_product
	addToBasket: async (
		basketId: number,
		productId: number,
		quantity: number = 1,
		format?: string
	): Promise<Basket> => {
		const response = await apiClient.post(
			`/api/baskets/${basketId}/add_product/`,
			{
				product_id: productId,
				quantity,
				format,
			}
		)
		return response.data
	},

	// ✅ Удалить товар из корзины
	removeFromBasket: async (
		basketId: number,
		productId: number
	): Promise<void> => {
		await apiClient.delete(
			`/api/baskets/${basketId}/remove-product/${productId}/`
		)
	},

	// Очистить корзину
	clearBasket: async (basketId: number): Promise<void> => {
		await apiClient.delete(`/api/baskets/${basketId}/items/`)
	},
}

// Сервис для работы с заказами
export const orderService = {
	// Получить все заказы пользователя
	getOrders: async (): Promise<ApiResponse<Order>> => {
		const response = await apiClient.get('/orders/')
		return response.data
	},

	// Получить заказ по ID
	getOrder: async (id: number): Promise<Order> => {
		const response = await apiClient.get(`/orders/${id}/`)
		return response.data
	},

	// Создать заказ из корзины
	createOrder: async (basketId: number): Promise<Order> => {
		const response = await apiClient.post('/orders/', { basket: basketId })
		return response.data
	},
}

// Сервис для работы с историей загрузок
export const downloadService = {
	// Получить все загрузки пользователя
	getDownloads: async (): Promise<ApiResponse<Download>> => {
		const response = await apiClient.get('/api/downloads/')
		return response.data
	},

	// Удалить запись из истории загрузок
	deleteDownload: async (downloadId: number): Promise<void> => {
		await apiClient.delete(`/api/downloads/${downloadId}/`)
	},
}

// Сервис для работы с подписками
export const subscriptionService = {
	// Получить все планы подписок
	getPlans: async (): Promise<ApiResponse<Plan>> => {
		const response = await apiClient.get('/subscriptions/plans/')
		return response.data
	},

	// Получить подписки пользователя
	getSubscriptions: async (): Promise<ApiResponse<Subscription>> => {
		const response = await apiClient.get('/subscriptions/')
		return response.data
	},

	// Создать подписку
	createSubscription: async (planId: number): Promise<Subscription> => {
		const response = await apiClient.post('/subscriptions/', { plan: planId })
		return response.data
	},
}

// Сервис для аутентификации
export const authService = {
	// Вход в систему
	login: async (credentials: LoginCredentials): Promise<AuthTokens> => {
		const response = await apiClient.post('/api/auth/login/', credentials)
		return response.data
	},

	// Регистрация
	register: async (data: RegisterData): Promise<User> => {
		const response = await apiClient.post('/api/users/register/', data)
		return response.data
	},

	// Обновить токен
	refreshToken: async (refreshToken: string): Promise<AuthTokens> => {
		const response = await apiClient.post('/api/auth/refresh/', {
			refresh: refreshToken,
		})
		return response.data
	},

	// Получить информацию о текущем пользователе
	getCurrentUser: async (): Promise<User> => {
		const response = await apiClient.get('/api/users/me/')
		return response.data
	},

	// Выход из системы
	logout: async (): Promise<void> => {
		await apiClient.post('/api/users/logout/')
	},

	// Поиск пользователей
	searchUsers: async (search?: string): Promise<User[]> => {
		const params = search ? `?search=${encodeURIComponent(search)}` : ''
		const response = await apiClient.get(`/api/users/search${params}`)
		return response.data
	},
}

// Сервис для работы с чатами
export const chatService = {
	// Получить все чаты пользователя
	getChats: async (): Promise<ApiResponse<Chat>> => {
		const response = await apiClient.get('/api/chats/')
		return response.data
	},

	// Получить чат по ID
	getChat: async (id: number): Promise<Chat> => {
		const response = await apiClient.get(`/api/chats/${id}/`)
		return response.data
	},

	// Создать новый чат
	createChat: async (participant2Id: number): Promise<Chat> => {
		const response = await apiClient.post('/api/chats/', {
			participant2_id: participant2Id,
		})
		return response.data
	},

	// Закрепить/открепить чат
	togglePin: async (chatId: number): Promise<{ is_pinned: boolean }> => {
		const response = await apiClient.post(`/api/chats/${chatId}/toggle_pin/`)
		return response.data
	},
}

// Сервис для работы с сообщениями
export const messageService = {
	// Получить сообщения чата
	getMessages: async (chatId: number): Promise<ApiResponse<Message>> => {
		const response = await apiClient.get(`/api/messages/?chat_id=${chatId}`)
		return response.data
	},

	// Отправить текстовое сообщение
	sendTextMessage: async (
		chatId: number,
		content: string
	): Promise<Message> => {
		const response = await apiClient.post('/api/messages/', {
			chat: chatId,
			message_type: 'text',
			content,
		})
		return response.data
	},

	// Отправить товары
	sendProducts: async (
		chatId: number,
		productIds: number[],
		selectedFormats: Record<number, string[]>
	): Promise<Message> => {
		const response = await apiClient.post('/api/messages/', {
			chat: chatId,
			message_type: 'product',
			content: '',
			product_ids: productIds,
			selected_formats: selectedFormats,
		})
		return response.data
	},

	// Отправить корзину
	sendBasket: async (chatId: number, basketId: number): Promise<Message> => {
		const response = await apiClient.post('/api/messages/', {
			chat: chatId,
			message_type: 'basket',
			content: '',
			basket_id: basketId,
		})
		return response.data
	},

	// Отметить сообщение как прочитанное
	markRead: async (messageId: number): Promise<{ is_read: boolean }> => {
		const response = await apiClient.post(
			`/api/messages/${messageId}/mark_read/`
		)
		return response.data
	},

	// Отметить все сообщения чата как прочитанные
	markChatRead: async (chatId: number): Promise<{ status: string }> => {
		const response = await apiClient.post('/api/messages/mark_chat_read/', {
			chat_id: Number(chatId), // Убеждаемся, что это число
		})
		return response.data
	},
}
