// Конфигурация приложения
export const config = {
	// URL API бэкенда
	API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
	// Базовый домен для "URL с ключом": https://<ключ>.<домен>
	PLUGIN_KEYED_API_BASE_DOMAIN:
		process.env.NEXT_PUBLIC_PLUGIN_KEYED_API_BASE_DOMAIN || 'vizhub.pro',
	// Прямая ссылка на установщик плагина (zip/msi/exe)
	PLUGIN_DOWNLOAD_URL: process.env.NEXT_PUBLIC_PLUGIN_DOWNLOAD_URL || '',
	PLUGIN_DOWNLOAD_URL_2022: process.env.NEXT_PUBLIC_PLUGIN_DOWNLOAD_URL_2022 || '',
	PLUGIN_DOWNLOAD_URL_2023: process.env.NEXT_PUBLIC_PLUGIN_DOWNLOAD_URL_2023 || '',
	PLUGIN_DOWNLOAD_URL_2024: process.env.NEXT_PUBLIC_PLUGIN_DOWNLOAD_URL_2024 || '',

	// Настройки приложения
	APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || 'Sofa Marketplace',
	APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',

	// Настройки пагинации
	DEFAULT_PAGE_SIZE: 20,

	// Настройки форматов файлов (по умолчанию только .rfa)
	DEFAULT_FORMAT: '.rfa',

	// Настройки валюты
	CURRENCY: 'RUB',
	CURRENCY_SYMBOL: '₽',
}
