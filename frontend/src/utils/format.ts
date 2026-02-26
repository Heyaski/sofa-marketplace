/** Убирает лишние нули после запятой (33.0 → 33, 74.5 → 74.5) */
export function formatDimension(value: number | string | null | undefined): string {
	if (value == null || value === '') return ''
	const num = typeof value === 'string' ? parseFloat(value) : Number(value)
	if (Number.isNaN(num)) return String(value)
	return num % 1 === 0 ? String(Math.floor(num)) : String(num)
}
