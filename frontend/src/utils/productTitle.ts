/**
 * Возвращает название товара без бренда.
 * Пример: "Табурет Handy SQ черного цвета" + brand "Handy SQ" → "Табурет черного цвета"
 */
export function getTitleWithoutBrand(title: string, brand?: string | null): string {
	if (!title) return ''
	if (!brand || !brand.trim()) return title
	const b = brand.trim()
	const escaped = b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
	const re = new RegExp(`\\s*${escaped}\\s*`, 'gi')
	return title.replace(re, ' ').replace(/\s+/g, ' ').trim()
}
