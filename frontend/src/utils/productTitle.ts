/**
 * Возвращает название товара без бренда.
 * Стараемся оставить только тип мебели и цвет.
 * Пример: "Табурет мягкий Handy светло-коричневого цвета" + brand "Handy"
 *   → "Табурет светло-коричневого цвета"
 */
export function getTitleWithoutBrand(title: string, brand?: string | null): string {
	if (!title) return ''
	let base = title
	if (brand && brand.trim()) {
		const escaped = brand.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
		const re = new RegExp(`\\s*${escaped}\\s*`, 'gi')
		base = base.replace(re, ' ')
	}
	base = base.replace(/\s+/g, ' ').trim()
	if (!base) return ''

	// Первое слово — тип мебели
	const typeMatch = base.match(/^\s*([^\s,]+)/)
	const itemType = typeMatch?.[1] ?? ''

	// Хвост с цветом: (префикс-)слово непосредственно перед "цвет..." в конце строки
	// Точный паттерн исключает захват модельных слов (Виконт, Дизайн и т.п.)
	const colorMatch = base.match(/((?:[А-Яа-яЁё]+-)*[А-Яа-яЁё]+\s+цвет[а-я]*)\s*$/i)
	if (itemType && colorMatch?.[1]) {
		const colorPart = colorMatch[1].trim()
		return `${itemType} ${colorPart}`.trim()
	}

	return base
}
