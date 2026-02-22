// Типы для изображений товара
export interface ProductImage {
	id: number
	image_url: string
	order: number
}

// Типы для файловых ресурсов (изображения и 3D модели)
export interface FileAsset {
	asset_id: string
	file_type: 'image' | '3d_model'
	file_url: string
	description?: string
}

// Типы для продуктов
export interface Product {
	id: number
	title: string
	category: Category
	subcategory?: string
	description: string
	price: number
	
	// Характеристики
	article?: string
	material: string
	style: string
	color: string
	color_rgb?: string
	brand?: string
	country?: string
	
	// Размеры
	width?: number | null
	height?: number | null
	depth?: number | null
	weight?: number | null
	
	// Наличие
	availability?: 'in_stock' | 'on_order' | 'out_of_stock'
	
	is_active: boolean
	is_trending: boolean
	
	// Изображения
	image?: string | null
	photo_url?: string
	images?: ProductImage[]
	asset_images?: FileAsset[]
	
	// 3D модели
	image_asset_ids?: string
	model_3d_asset_ids?: string
	asset_3d_models?: FileAsset[]
	model_glb?: string
	model_fbx?: string
	model_rfa?: string
	model_usdz?: string
	model_ar_glb?: string
}

// Типы для категорий
export interface Category {
	id: number
	name: string
	slug: string
	parent?: number | null
	parent_category?: {
		id: number
		name: string
		slug: string
	} | null
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
	share_token?: string
	share_url?: string
	can_edit?: boolean
	is_owner?: boolean
}

export interface BasketEditRequest {
	id: number
	basket: Basket
	requester: User
	status: 'pending' | 'approved' | 'rejected'
	created_at: string
	updated_at: string
	message?: string
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
	subscription_type: 'basic' | 'premium'
	price: string | number
	duration_days: number
	description: string
	is_active: boolean
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
	category?: number | string  // число или "1,2,3" для множественного выбора
	material?: string
	style?: string
	color?: string
	color_hue?: string
	brand?: string
	country?: string
	availability?: 'in_stock' | 'on_order' | 'out_of_stock'
	price_min?: number
	price_max?: number
	width_min?: number
	width_max?: number
	depth_min?: number
	depth_max?: number
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
	chat_type: 'private' | 'group'
	name?: string
	participant1?: User
	participant2?: User
	participants_list?: User[]
	created_at: string
	updated_at: string
	is_pinned: boolean
	last_message?: Message | null
	unread_count: number
	other_participant?: User
	created_by?: User
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

// Типы для статических страниц
export interface StaticPage {
	id: number
	page_type: 'privacy' | 'terms' | 'about' | 'contact' | 'other'
	title: string
	content: string
	slug: string
	is_active: boolean
	created_at: string
	updated_at: string
}