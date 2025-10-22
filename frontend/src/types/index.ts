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
}

// Типы для категорий
export interface Category {
	id: number
	name: string
	slug: string
	parent?: number | null
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

// Типы для пользователей
export interface User {
	id: number
	username: string
	email: string
	first_name: string
	last_name: string
	is_active: boolean
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
