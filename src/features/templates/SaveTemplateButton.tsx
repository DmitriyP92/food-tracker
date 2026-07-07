import { useState } from 'react'
import { saveTemplate } from '../../db/db'
import type { Category, Meal } from '../../types/models'
import styles from './SaveTemplateButton.module.css'

interface Props {
  category: Category
  meal: Meal
}

/** Сохранение текущего приёма пищи как шаблона с ручным именем (US-14). */
export function SaveTemplateButton({ category, meal }: Props) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    setError(null)
    try {
      await saveTemplate({ name, categoryId: category.id, items: meal.items })
      setOpen(false)
      setName('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить')
    }
  }

  if (!open) {
    return (
      <button type="button" className={styles.trigger} onClick={() => setOpen(true)}>
        В шаблоны
      </button>
    )
  }

  return (
    <div className={styles.form}>
      <input
        type="text"
        placeholder="Название шаблона"
        aria-label={`Название шаблона: ${category.name}`}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void save()
        }}
        autoFocus
      />
      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={() => void save()}>
          Сохранить
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
      {error && <p className={styles.error}>{error}</p>}
    </div>
  )
}
