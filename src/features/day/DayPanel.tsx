import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useDroppable } from '@dnd-kit/core'
import {
  addCategory,
  copyDay,
  deleteCategory,
  getDay,
  listCategories,
  removeMealItem,
  updateMealItem,
} from '../../db/db'
import type { Category, Meal, MealItem } from '../../types/models'
import { SaveTemplateButton } from '../templates/SaveTemplateButton'
import { dayTotal, mealTotal } from './totals'
import { formatDayTitle, shiftISODate } from './date'
import styles from './DayPanel.module.css'

interface Props {
  date: string
  onAddRequest: (category: Category) => void
}

/**
 * Дневник выбранного дня: приёмы пищи по категориям, правка веса (US-8),
 * удаление (US-9), итоги (US-10). Все изменения сохраняются сразу (US-11).
 */
export function DayPanel({ date, onAddRequest }: Props) {
  const categories = useLiveQuery(listCategories, []) ?? []
  const day = useLiveQuery(() => getDay(date), [date])
  const [copyError, setCopyError] = useState<string | null>(null)

  const isEmpty = day !== undefined && dayTotal(day) === 0

  const copyYesterday = async () => {
    setCopyError(null)
    try {
      await copyDay(shiftISODate(date, -1), date)
    } catch (e) {
      setCopyError(e instanceof Error ? e.message : 'Не удалось скопировать')
    }
  }

  return (
    <div className={styles.day}>
      <header className={styles.dayHeader}>
        <h2 className={styles.title}>{formatDayTitle(date)}</h2>
        {isEmpty && (
          <button type="button" className={styles.copyYesterday} onClick={() => void copyYesterday()}>
            Скопировать вчера
          </button>
        )}
      </header>
      {copyError && <p className={styles.copyError}>{copyError}</p>}
      {categories.map((category) => (
        <MealSection
          key={category.id}
          date={date}
          category={category}
          meal={day?.meals.find((m) => m.categoryId === category.id)}
          onAddRequest={() => onAddRequest(category)}
        />
      ))}
      <AddCategoryButton />
      <footer className={styles.dayTotal}>
        <span>Итого за день</span>
        <span className={styles.dayTotalValue}>{dayTotal(day)} г</span>
      </footer>
    </div>
  )
}

function MealSection({
  date,
  category,
  meal,
  onAddRequest,
}: {
  date: string
  category: Category
  meal: Meal | undefined
  onAddRequest: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: category.id, data: { category } })
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const removeCategory = async () => {
    if (!window.confirm(`Удалить категорию «${category.name}»?`)) return
    setDeleteError(null)
    try {
      await deleteCategory(category.id)
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Не удалось удалить')
    }
  }

  return (
    <section
      ref={setNodeRef}
      className={`${styles.meal} ${isOver ? styles.mealOver : ''}`}
      aria-label={category.name}
    >
      <header className={styles.mealHeader}>
        <h3 className={styles.mealTitle}>{category.name}</h3>
        <span className={styles.mealActions}>
          {meal && meal.items.length > 0 && <SaveTemplateButton category={category} meal={meal} />}
          <span className={styles.mealTotal}>{mealTotal(meal)} г</span>
          {!category.isDefault && (
            <button
              type="button"
              className={styles.removeCategory}
              aria-label={`Удалить категорию: ${category.name}`}
              onClick={() => void removeCategory()}
            >
              ×
            </button>
          )}
        </span>
      </header>
      {deleteError && <p className={styles.categoryError}>{deleteError}</p>}
      {meal && meal.items.length > 0 ? (
        <ul className={styles.items}>
          {meal.items.map((item, index) => (
            <MealItemRow
              key={`${date}-${category.id}-${index}-${item.weight}`}
              item={item}
              onWeightChange={(weight) =>
                void updateMealItem(date, category.id, index, { weight }).catch(() => undefined)
              }
              onRemove={() => void removeMealItem(date, category.id, index)}
            />
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>Пусто — перетащите продукт из библиотеки или добавьте:</p>
      )}
      <button type="button" className={styles.addToMeal} onClick={onAddRequest}>
        ＋ Добавить
      </button>
    </section>
  )
}

/** Добавление пользовательской категории (US-13). */
function AddCategoryButton() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    setError(null)
    try {
      await addCategory(name)
      setOpen(false)
      setName('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось добавить')
    }
  }

  if (!open) {
    return (
      <button type="button" className={styles.addCategory} onClick={() => setOpen(true)}>
        ＋ Категория
      </button>
    )
  }

  return (
    <div className={styles.addCategoryForm}>
      <input
        type="text"
        placeholder="Название категории"
        aria-label="Название категории"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void save()
        }}
        autoFocus
      />
      <div className={styles.addCategoryActions}>
        <button type="button" className={styles.addCategoryPrimary} onClick={() => void save()}>
          Добавить
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            setError(null)
          }}
        >
          Отмена
        </button>
      </div>
      {error && <p className={styles.categoryError}>{error}</p>}
    </div>
  )
}

function MealItemRow({
  item,
  onWeightChange,
  onRemove,
}: {
  item: MealItem
  onWeightChange: (weight: number) => void
  onRemove: () => void
}) {
  const commit = (value: string) => {
    const weight = Number(value)
    if (Number.isFinite(weight) && weight > 0 && weight !== item.weight) onWeightChange(weight)
  }

  return (
    <li className={styles.item}>
      <span className={styles.itemName}>{item.name}</span>
      <input
        className={styles.itemWeight}
        type="number"
        inputMode="decimal"
        min="1"
        defaultValue={item.weight}
        aria-label={`Вес: ${item.name}`}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
      />
      <span className={styles.itemUnit}>{item.unit}</span>
      <button
        type="button"
        className={styles.itemRemove}
        aria-label={`Убрать: ${item.name}`}
        onClick={onRemove}
      >
        ×
      </button>
    </li>
  )
}
