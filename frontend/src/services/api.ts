import apiClient from '../lib/api'
import {
	ApiResponse,
	AuthTokens,
	Basket,
	BasketEditRequest,
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
	StaticPage,
	Subscription,
	User,
} from '../types'

// Сервис для работы с продуктами
export const productService = {
	// Получить все продукты с фильтрацией и пагинацией
	getProducts: async (
		filters?: ProductFilters,
		page?: number,
		pageSize?: number
	): Promise<ApiResponse<Product>> => {
		const params = new URLSearchParams()

		if (filters) {
			Object.entries(filters).forEach(([key, value]) => {
				if (value !== undefined && value !== null && value !== '') {
					// Преобразуем price_min и price_max в price__gte и price__lte для DjangoFilterBackend
					if (key === 'price_min') {
						params.append('price__gte', value.toString())
					} else if (key === 'price_max') {
						params.append('price__lte', value.toString())
					} else if (key === 'width_min') {
						params.append('width__gte', value.toString())
					} else if (key === 'width_max') {
						params.append('width__lte', value.toString())
					} else if (key === 'depth_min') {
						params.append('depth__gte', value.toString())
					} else if (key === 'depth_max') {
						params.append('depth__lte', value.toString())
					} else {
						params.append(key, value.toString())
					}
				}
			})
		}

		if (page) {
			params.append('page', page.toString())
		}
		if (pageSize) {
			params.append('page_size', pageSize.toString())
		} else if (!page) {
			// Если не указан page и pageSize, загружаем все товары для вычисления диапазонов
			params.append('page_size', '1000')
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

	// Генерировать публичную ссылку на корзину
	generateShareLink: async (basketId: number): Promise<{ share_token: string; share_url: string }> => {
		const response = await apiClient.post(`/api/baskets/${basketId}/generate_share_link/`)
		return response.data
	},

	// Получить корзину по публичному токену (без авторизации)
	getBasketByShareToken: async (shareToken: string): Promise<Basket> => {
		const response = await apiClient.get(`/api/baskets/share/${shareToken}/`)
		return response.data
	},

	// Получить запросы на редактирование для корзины
	getBasketEditRequests: async (basketId: number): Promise<BasketEditRequest[]> => {
		const response = await apiClient.get(`/api/baskets/${basketId}/edit_requests/`)
		return response.data
	},
}

// Сервис для работы с запросами на редактирование корзины
export const basketEditRequestService = {
	// Получить все запросы
	getRequests: async (): Promise<ApiResponse<BasketEditRequest>> => {
		const response = await apiClient.get('/api/basket-edit-requests/')
		return response.data
	},

	// Создать запрос на редактирование
	createRequest: async (basketId: number, message?: string): Promise<BasketEditRequest> => {
		const response = await apiClient.post('/api/basket-edit-requests/', {
			basket_id: basketId,
			message,
		})
		return response.data
	},

	// Одобрить запрос
	approveRequest: async (requestId: number): Promise<BasketEditRequest> => {
		const response = await apiClient.post(`/api/basket-edit-requests/${requestId}/approve/`)
		return response.data
	},

	// Отклонить запрос
	rejectRequest: async (requestId: number): Promise<BasketEditRequest> => {
		const response = await apiClient.post(`/api/basket-edit-requests/${requestId}/reject/`)
		return response.data
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
	getPlans: async (): Promise<ApiResponse<Plan> | Plan[]> => {
		const response = await apiClient.get('/api/subscriptions/plans/')
		return response.data
	},

	// Получить подписки пользователя
	getSubscriptions: async (): Promise<ApiResponse<Subscription>> => {
		const response = await apiClient.get('/api/subscriptions/')
		return response.data
	},

	// Создать подписку
	createSubscription: async (planId: number): Promise<Subscription> => {
		const response = await apiClient.post('/api/subscriptions/', { plan: planId })
		return response.data
	},

	// Создать платеж для подписки через ЮКассу
	createSubscriptionPayment: async (
		subscriptionType: string,
		returnUrl?: string
	): Promise<{
		payment_id: string
		confirmation_url: string
		amount: string
		currency: string
	}> => {
		const response = await apiClient.post('/api/subscriptions/create_payment/', {
			subscription_type: subscriptionType,
			return_url: returnUrl,
		})
		return response.data
	},

	// Проверить статус платежа
	checkPaymentStatus: async (paymentId: string): Promise<{
		status: string
		paid: boolean
		subscription_activated?: boolean
		subscription_type?: string
		subscription_end_date?: string
	}> => {
		const response = await apiClient.post('/api/subscriptions/check_payment_status/', {
			payment_id: paymentId,
		})
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

	// Обновить информацию о текущем пользователе
	updateUser: async (data: Partial<User>): Promise<User> => {
		const response = await apiClient.patch('/api/users/me/', data)
		return response.data
	},

	// Выход из системы
	logout: async (): Promise<void> => {
		await apiClient.post('/api/users/logout/')
	},

	// Поиск пользователей
	searchUsers: async (search?: string): Promise<User[] | ApiResponse<User>> => {
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

	// Создать новый чат (приватный или групповой)
	createChat: async (
		participant2Id?: number,
		participantIds?: number[],
		name?: string,
		chatType: 'private' | 'group' = 'private'
	): Promise<Chat> => {
		const data: any = {
			chat_type: chatType,
		}
		if (chatType === 'private' && participant2Id) {
			data.participant2_id = participant2Id
		} else if (chatType === 'group' && participantIds) {
			data.participant_ids = participantIds
			data.name = name
		}
		const response = await apiClient.post('/api/chats/', data)
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

// Сервис для работы со статическими страницами
export const pageService = {
	// Получить страницу по типу (privacy, terms и т.д.)
	// Использует стандартный DRF retrieve endpoint с lookup_field='page_type'
	// Добавляем timestamp для предотвращения кеширования
	getPageByType: async (pageType: string): Promise<StaticPage> => {
		const timestamp = Date.now()
		// Используем только timestamp, без дополнительных заголовков (чтобы избежать CORS проблем)
		const response = await apiClient.get(`/api/pages/${pageType}/?t=${timestamp}`)
		return response.data
	},

	// Получить страницу по slug
	getPageBySlug: async (slug: string): Promise<StaticPage> => {
		const timestamp = Date.now()
		const response = await apiClient.get(`/api/pages/by-slug/?slug=${slug}&t=${timestamp}`)
		return response.data
	},

	// Получить все страницы
	getPages: async (): Promise<ApiResponse<StaticPage>> => {
		const timestamp = Date.now()
		const response = await apiClient.get(`/api/pages/?t=${timestamp}`)
		return response.data
	},
}