import { useRef } from 'react'
import styles from './SearchField.module.css'

interface Props {
  value: string
  onChange: (value: string) => void
  ariaLabel: string
}

/** Поле поиска по библиотеке (US-5) с кнопкой очистки. */
export function SearchField({ value, onChange, ariaLabel }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className={styles.wrap}>
      <input
        ref={inputRef}
        type="search"
        className={styles.input}
        placeholder="Поиск…"
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button
          type="button"
          className={styles.clear}
          aria-label="Очистить поиск"
          onClick={() => {
            onChange('')
            inputRef.current?.focus()
          }}
        >
          ×
        </button>
      )}
    </div>
  )
}
