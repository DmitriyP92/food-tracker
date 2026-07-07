import type { Product } from '../../types/models'

/**
 * Поиск по библиотеке (US-5): по полному названию или его части,
 * регистронезависимый. Пустой запрос возвращает всё.
 */
export function filterProducts(products: Product[], query: string): Product[] {
  const q = query.trim().toLowerCase()
  if (!q) return products
  return products.filter((product) => product.name.toLowerCase().includes(q))
}
