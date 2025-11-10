// Типы для изображений товара
export interface ProductImage {
	id: number
	image_url: string
	order: number
}

// Типы для продуктов
export interface Product {
	id: number
	title: string
	category: Category
	description: string
	price: number
	material: string
	style: string
	color: string
	is_active: boolean
	is_trending: boolean
	image?: string | null
	images?: ProductImage[]
}

// Типы для категорий
export interface Category {
	id: number
	name: string
	slug: string
	parent?: number | null
	image?: string | null
}

// Типы для корзины
export interface BasketItem {
	id: number
	product: Product
	quantity: number
	format?: string
}

export interface Basket {
	id: number
	name: string
	user?: User | number
	items: BasketItem[]
	created_at: string
	updated_at: string
}

// Типы для заказов
export interface Order {
	id: number
	basket: Basket
	status: string
	total_amount: number
	created_at: string
	updated_at: string
}

// Типы для подписок
export interface Plan {
	id: number
	name: string
	price: number
	description: string
	features: string[]
}

export interface Subscription {
	id: number
	plan: Plan
	user: number
	status: string
	start_date: string
	end_date: string
}

// Типы для истории загрузок
export interface Download {
	id: number
	product: Product
	created_at: string
	file?: string | null
}

// Типы для пользователей
export interface UserProfile {
	subscription_type: 'trial' | 'basic' | 'premium'
	subscription_type_display?: string
	card_number: string
	card_holder: string
	card_expiry: string
	card_cvv: string
	chat_notifications: boolean
	new_models_notifications: boolean
}

export interface User {
	id: number
	username: string
	email: string
	first_name: string
	last_name: string
	is_active: boolean
	profile?: UserProfile
}

// Типы для API ответов
export interface ApiResponse<T> {
	count: number
	next: string | null
	previous: string | null
	results: T[]
}

// Типы для фильтров
export interface ProductFilters {
	category?: number
	material?: string
	style?: string
	color?: string
	price_min?: number
	price_max?: number
	is_active?: boolean
	is_trending?: boolean
	search?: string
	ordering?: string
}

// Типы для аутентификации
export interface LoginCredentials {
	username: string
	password: string
}

export interface RegisterData {
	username: string
	email: string
	password: string
	password_confirm: string
	first_name: string
	last_name: string
}

export interface AuthTokens {
	access: string
	refresh: string
}

// Типы для чатов
export interface Chat {
	id: number
	participant1: User
	participant2: User
	created_at: string
	updated_at: string
	is_pinned: boolean
	last_message?: Message | null
	unread_count: number
	other_participant?: User
}

export interface Message {
	id: number
	chat: number
	sender: User
	message_type: 'text' | 'product' | 'basket'
	content: string
	created_at: string
	is_read: boolean
	products?: MessageProduct[]
	baskets?: MessageBasket[]
}

export interface MessageProduct {
	id: number
	product: Product
	selected_formats: string[]
}

export interface MessageBasket {
	id: number
	basket: Basket
}
