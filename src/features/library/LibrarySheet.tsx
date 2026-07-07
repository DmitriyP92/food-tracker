import { useLiveQuery } from 'dexie-react-hooks'
import { addProductToMeal, listProducts } from '../../db/db'
import type { Category, Product } from '../../types/models'
import styles from './LibrarySheet.module.css'

interface Props {
  date: string
  category: Category
  onClose: () => void
}

/**
 * Шторка библиотеки: тап по продукту добавляет его в выбранный приём (US-7,
 * основной способ на iPhone). Шторка остаётся открытой — можно добавить
 * несколько продуктов подряд.
 */
export function LibrarySheet({ date, category, onClose }: Props) {
  const products = useLiveQuery(listProducts, []) ?? []

  const add = (product: Product) => {
    void addProductToMeal(date, category.id, product)
  }

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={styles.sheet}
        role="dialog"
        aria-label={`Добавить в: ${category.name}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <span className={styles.title}>Добавить в: {category.name}</span>
          <button type="button" className={styles.close} onClick={onClose}>
            Готово
          </button>
        </header>
        {products.length === 0 ? (
          <p className={styles.empty}>Библиотека пуста — сначала добавьте продукт.</p>
        ) : (
          <ul className={styles.list}>
            {products.map((product) => (
              <li key={product.id}>
                <button type="button" className={styles.product} onClick={() => add(product)}>
                  <span>{product.name}</span>
                  <span className={styles.weight}>
                    {product.defaultWeight} {product.unit}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
