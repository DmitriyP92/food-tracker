import { useState, type FormEvent } from 'react'
import { DEFAULT_UNIT, UNITS } from './units'
import styles from './ProductForm.module.css'

export interface ProductFormValues {
  name: string
  defaultWeight: number
  unit: string
}

interface Props {
  initial?: ProductFormValues
  submitLabel: string
  onSubmit: (values: ProductFormValues) => Promise<void>
  onCancel: () => void
  onDelete?: () => Promise<void>
}

/** Форма добавления/редактирования продукта (US-1, US-2, US-3). */
export function ProductForm({ initial, submitLabel, onSubmit, onCancel, onDelete }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [weight, setWeight] = useState(initial ? String(initial.defaultWeight) : '')
  const [unit, setUnit] = useState(initial?.unit ?? DEFAULT_UNIT)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    try {
      await onSubmit({ name, defaultWeight: Number(weight), unit })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить')
    }
  }

  return (
    <form className={styles.form} onSubmit={(e) => void handleSubmit(e)}>
      <input
        className={styles.name}
        type="text"
        placeholder="Название"
        aria-label="Название продукта"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
      />
      <div className={styles.row}>
        <input
          className={styles.weight}
          type="number"
          inputMode="decimal"
          min="1"
          placeholder="Вес"
          aria-label="Вес по умолчанию"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
        />
        <select
          className={styles.unit}
          aria-label="Единица измерения"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
        >
          {UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.actions}>
        <button type="submit" className={styles.primary}>
          {submitLabel}
        </button>
        <button type="button" onClick={onCancel}>
          Отмена
        </button>
        {onDelete && (
          <button
            type="button"
            className={styles.danger}
            onClick={() => void onDelete().catch(() => setError('Не удалось удалить'))}
          >
            Удалить
          </button>
        )}
      </div>
    </form>
  )
}
