import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useDraggable } from '@dnd-kit/core'
import { addItemToMeal, copyDay, copyMeal, getDay, listCategories } from '../../db/db'
import type { MealItem } from '../../types/models'
import { formatDayTitle, shiftISODate, todayISO } from '../day/date'
import { mealTotal } from '../day/totals'
import styles from './HistoryPanel.module.css'

interface Props {
  openDate: string
}

/**
 * Панель истории: просмотр другого дня (US-18) и переиспользование еды.
 * На iPad продукт перетаскивается из истории в открытый день (US-25) —
 * дата назначения всегда = открытый день, календарь не нужен.
 * Тап по «+» и «Скопировать день» — то же самое без перетаскивания (US-26).
 */
export function HistoryPanel({ openDate }: Props) {
  const [histDate, setHistDate] = useState(() => shiftISODate(todayISO(), -1))
  const [status, setStatus] = useState<string | null>(null)
  const categories = useLiveQuery(listCategories, []) ?? []
  const day = useLiveQuery(() => getDay(histDate), [histDate])

  const sameDay = histDate === openDate
  const isEmpty = !day || day.meals.every((m) => m.items.length === 0)

  const copyWholeDay = async () => {
    setStatus(null)
    try {
      await copyDay(histDate, openDate)
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Не удалось скопировать')
    }
  }

  const copyOneMeal = async (categoryId: string) => {
    setStatus(null)
    try {
      await copyMeal(histDate, openDate, categoryId)
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Не удалось скопировать')
    }
  }

  const copyItem = (categoryId: string, item: MealItem) => {
    setStatus(null)
    void addItemToMeal(openDate, categoryId, { ...item }).catch(() =>
      setStatus('Не удалось скопировать'),
    )
  }

  return (
    <div className={styles.history}>
      <nav className={styles.nav} aria-label="Дата истории">
        <button type="button" aria-label="История: день назад" onClick={() => setHistDate((d) => shiftISODate(d, -1))}>
          ‹
        </button>
        <input
          type="date"
          aria-label="История: выбрать дату"
          value={histDate}
          onChange={(e) => e.target.value && setHistDate(e.target.value)}
        />
        <button type="button" aria-label="История: день вперёд" onClick={() => setHistDate((d) => shiftISODate(d, 1))}>
          ›
        </button>
      </nav>
      <h3 className={styles.title}>{formatDayTitle(histDate)}</h3>

      {sameDay ? (
        <p className={styles.empty}>Это открытый день — выберите другой, чтобы скопировать из него.</p>
      ) : isEmpty ? (
        <p className={styles.empty}>В этот день записей нет.</p>
      ) : (
        <>
          <button type="button" className={styles.copyDay} onClick={() => void copyWholeDay()}>
            Копировать в текущий день
          </button>
          {categories.map((category) => {
            const meal = day?.meals.find((m) => m.categoryId === category.id)
            if (!meal || meal.items.length === 0) return null
            return (
              <section key={category.id} className={styles.meal} aria-label={`История: ${category.name}`}>
                <header className={styles.mealHeader}>
                  <h4 className={styles.mealTitle}>{category.name}</h4>
                  <span className={styles.mealTotal}>{mealTotal(meal)} г</span>
                </header>
                <button
                  type="button"
                  className={styles.copyMeal}
                  aria-label={`Копировать приём в текущий день: ${category.name}`}
                  onClick={() => void copyOneMeal(category.id)}
                >
                  Копировать в текущий день
                </button>
                <ul className={styles.items}>
                  {meal.items.map((item, index) => (
                    <HistoryItem
                      key={`${histDate}-${category.id}-${index}`}
                      id={`hist:${histDate}:${category.id}:${index}`}
                      item={item}
                      onCopy={() => copyItem(category.id, item)}
                    />
                  ))}
                </ul>
              </section>
            )
          })}
        </>
      )}
      {status && <p className={styles.error}>{status}</p>}
    </div>
  )
}

function HistoryItem({ id, item, onCopy }: { id: string; item: MealItem; onCopy: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { item },
  })

  return (
    <li
      ref={setNodeRef}
      className={`${styles.item} ${isDragging ? styles.dragging : ''}`}
      {...listeners}
      {...attributes}
    >
      <span className={styles.itemName}>{item.name}</span>
      <span className={styles.itemWeight}>
        {item.weight} {item.unit}
      </span>
      <button
        type="button"
        className={styles.itemCopy}
        aria-label={`Скопировать в открытый день: ${item.name}`}
        onClick={onCopy}
      >
        ＋
      </button>
    </li>
  )
}
