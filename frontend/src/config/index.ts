// Конфигурация приложения
export const config = {
	// URL API бэкенда
	API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',

	// Настройки приложения
	APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || 'Sofa Marketplace',
	APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',

	// Настройки пагинации
	DEFAULT_PAGE_SIZE: 20,

	// Настройки форматов файлов
	SUPPORTED_FORMATS: ['.fbx', '.glb', '.rfa', '.usdz'],

	// Настройки валюты
	CURRENCY: 'RUB',
	CURRENCY_SYMBOL: '₽',
}
