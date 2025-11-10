/**
 * Валидация и форматирование данных банковской карты
 */

/**
 * Форматирует номер карты в формат XXXX-XXXX-XXXX-XXXX
 * Разрешает только цифры
 */
export const formatCardNumber = (value: string): string => {
	// Удаляем все нецифровые символы
	const numbers = value.replace(/\D/g, '')

	// Ограничиваем до 16 цифр
	const limited = numbers.slice(0, 16)

	// Добавляем дефисы каждые 4 цифры
	return limited.replace(/(\d{4})(?=\d)/g, '$1-')
}

/**
 * Валидирует номер карты (должен содержать 16 цифр)
 */
export const validateCardNumber = (value: string): boolean => {
	const numbers = value.replace(/\D/g, '')
	return numbers.length === 16
}

/**
 * Форматирует имя держателя карты
 * Разрешает только буквы, пробелы, дефисы и апострофы
 */
export const formatCardHolder = (value: string): string => {
	// Разрешаем только буквы (включая кириллицу и латиницу), пробелы, дефисы и апострофы
	return value.replace(/[^a-zA-Zа-яА-ЯёЁ\s\-']/g, '')
}

/**
 * Валидирует имя держателя карты (минимум 2 символа)
 */
export const validateCardHolder = (value: string): boolean => {
	return value.trim().length >= 2
}

/**
 * Форматирует дату истечения в формат MM/YY
 * Разрешает только цифры, автоматически добавляет "/"
 */
export const formatCardExpiry = (value: string): string => {
	// Удаляем все нецифровые символы
	const numbers = value.replace(/\D/g, '')

	// Ограничиваем до 4 цифр
	const limited = numbers.slice(0, 4)

	// Добавляем "/" после первых 2 цифр
	if (limited.length > 2) {
		return `${limited.slice(0, 2)}/${limited.slice(2)}`
	}

	return limited
}

/**
 * Валидирует дату истечения карты
 */
export const validateCardExpiry = (value: string): boolean => {
	const numbers = value.replace(/\D/g, '')
	if (numbers.length !== 4) return false

	const month = parseInt(numbers.slice(0, 2), 10)
	const year = parseInt(numbers.slice(2, 4), 10)

	// Месяц должен быть от 01 до 12
	if (month < 1 || month > 12) return false

	// Год должен быть валидным (00-99)
	if (year < 0 || year > 99) return false

	// Проверяем, не истекла ли карта (опционально, можно добавить проверку текущей даты)
	return true
}

/**
 * Форматирует CVV код
 * Разрешает только цифры, максимум 4 символа
 */
export const formatCardCVV = (value: string): string => {
	// Удаляем все нецифровые символы
	const numbers = value.replace(/\D/g, '')

	// Ограничиваем до 4 цифр (некоторые карты имеют 4-значный CVV)
	return numbers.slice(0, 4)
}

/**
 * Валидирует CVV код (должен содержать 3 или 4 цифры)
 */
export const validateCardCVV = (value: string): boolean => {
	const numbers = value.replace(/\D/g, '')
	return numbers.length === 3 || numbers.length === 4
}

/**
 * Валидирует все данные карты
 * Возвращает объект с ошибками или null, если все валидно
 */
export const validateCardData = (cardData: {
	card_number: string
	card_holder: string
	card_expiry: string
	card_cvv: string
}): { [key: string]: string } | null => {
	const errors: { [key: string]: string } = {}

	// Проверка номера карты
	if (!validateCardNumber(cardData.card_number)) {
		errors.card_number = 'Номер карты должен содержать 16 цифр'
	}

	// Проверка держателя карты
	if (!validateCardHolder(cardData.card_holder)) {
		errors.card_holder = 'Введите имя держателя карты (минимум 2 символа)'
	}

	// Проверка срока действия
	if (!validateCardExpiry(cardData.card_expiry)) {
		errors.card_expiry = 'Введите корректный срок действия карты (MM/YY)'
	}

	// Проверка CVV
	if (!validateCardCVV(cardData.card_cvv)) {
		errors.card_cvv = 'CVV должен содержать 3 или 4 цифры'
	}

	return Object.keys(errors).length > 0 ? errors : null
}
