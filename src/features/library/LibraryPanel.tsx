import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useDraggable } from '@dnd-kit/core'
import { addProduct, deleteProduct, listProducts, updateProduct } from '../../db/db'
import type { Product } from '../../types/models'
import { ProductForm } from './ProductForm'
import styles from './LibraryPanel.module.css'

/**
 * Библиотека продуктов (US-1, US-2, US-3).
 * На iPad карточки перетаскиваются в приём пищи (US-7); тап — редактирование.
 */
export function LibraryPanel() {
  const products = useLiveQuery(listProducts, []) ?? []
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  return (
    <div>
      {adding ? (
        <ProductForm
          submitLabel="Добавить"
          onSubmit={async (values) => {
            await addProduct(values)
            setAdding(false)
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button type="button" className={styles.addButton} onClick={() => setAdding(true)}>
          ＋ Продукт
        </button>
      )}

      {products.length === 0 && !adding && (
        <p className={styles.empty}>Библиотека пуста. Добавьте первый продукт.</p>
      )}

      <ul className={styles.list}>
        {products.map((product) =>
          editingId === product.id ? (
            <li key={product.id}>
              <ProductForm
                initial={product}
                submitLabel="Сохранить"
                onSubmit={async (values) => {
                  await updateProduct(product.id, values)
                  setEditingId(null)
                }}
                onCancel={() => setEditingId(null)}
                onDelete={async () => {
                  await deleteProduct(product.id)
                  setEditingId(null)
                }}
              />
            </li>
          ) : (
            <DraggableProductCard
              key={product.id}
              product={product}
              onClick={() => setEditingId(product.id)}
            />
          ),
        )}
      </ul>
    </div>
  )
}

function DraggableProductCard({ product, onClick }: { product: Product; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: product.id,
    data: { product },
  })

  return (
    <li
      ref={setNodeRef}
      className={`${styles.card} ${isDragging ? styles.dragging : ''}`}
      {...listeners}
      {...attributes}
    >
      <button type="button" className={styles.cardButton} onClick={onClick}>
        <span className={styles.cardName}>{product.name}</span>
        <span className={styles.cardWeight}>
          {product.defaultWeight} {product.unit}
        </span>
      </button>
    </li>
  )
}

/** Карточка для DragOverlay — визуальный «призрак» под пальцем/курсором. */
export function ProductCardGhost({ product }: { product: Product }) {
  return (
    <div className={`${styles.card} ${styles.ghost}`}>
      <span className={styles.cardName}>{product.name}</span>
      <span className={styles.cardWeight}>
        {product.defaultWeight} {product.unit}
      </span>
    </div>
  )
}
