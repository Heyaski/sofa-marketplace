/** Диапазон ориентировочной цены относительно цены в каталоге (нет отдельных полей в API). */
export function getEstimatedPriceRange(price: number): { min: number; max: number } {
	const p = Number(price)
	if (!Number.isFinite(p) || p < 0) {
		return { min: 0, max: 0 }
	}
	if (p === 0) {
		return { min: 0, max: 0 }
	}
	const spread = Math.max(Math.round(p * 0.1), 1000)
	const min = Math.max(0, Math.floor(p - spread))
	const max = Math.ceil(p + spread)
	return min <= max ? { min, max } : { min: max, max: min }
}

export function formatRub(value: number): string {
	return new Intl.NumberFormat('ru-RU', {
		style: 'currency',
		currency: 'RUB',
		maximumFractionDigits: 0,
	}).format(value)
}
