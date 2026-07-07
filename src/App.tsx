import { useEffect, useState } from 'react'
import type { Category, Day } from './types/models'
import { getDay, listCategories } from './db/db'
import { formatDayTitle, shiftISODate, todayISO } from './features/day/date'
import styles from './App.module.css'

/**
 * Фаза 0 — каркас: тёмная тема, базовая раскладка (iPad — 3 панели,
 * iPhone — 1 колонка), навигация по датам, чтение дня из IndexedDB.
 * Наполнение панелей (библиотека, drag & drop, шаблоны) — Фазы 1–2.
 */
function App() {
  const [date, setDate] = useState(todayISO)
  const [day, setDay] = useState<Day | null>(null)
  const [categories, setCategories] = useState<Category[]>([])

  useEffect(() => {
    void listCategories().then(setCategories)
  }, [])

  useEffect(() => {
    let cancelled = false
    void getDay(date).then((loaded) => {
      if (!cancelled) setDay(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [date])

  const isToday = date === todayISO()

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1 className={styles.title}>Дневник питания</h1>
        <nav className={styles.dateNav} aria-label="Навигация по дням">
          <button type="button" onClick={() => setDate((d) => shiftISODate(d, -1))}>
            ‹
          </button>
          <button
            type="button"
            className={styles.todayButton}
            disabled={isToday}
            onClick={() => setDate(todayISO())}
          >
            Сегодня
          </button>
          <button type="button" onClick={() => setDate((d) => shiftISODate(d, 1))}>
            ›
          </button>
        </nav>
      </header>

      <main className={styles.layout}>
        <section className={styles.panel} aria-label="Библиотека продуктов">
          <h2 className={styles.panelTitle}>Библиотека</h2>
          <p className={styles.empty}>
            Библиотека пуста.
            <br />
            Добавление продуктов — Фаза 1.
          </p>
        </section>

        <section className={`${styles.panel} ${styles.dayPanel}`} aria-label="Дневник дня">
          <h2 className={styles.panelTitle}>{formatDayTitle(date)}</h2>
          {categories.map((category) => {
            const meal = day?.meals.find((m) => m.categoryId === category.id)
            const total = meal?.items.reduce((sum, item) => sum + item.weight, 0) ?? 0
            return (
              <section key={category.id} className={styles.meal}>
                <header className={styles.mealHeader}>
                  <h3 className={styles.mealTitle}>{category.name}</h3>
                  <span className={styles.mealTotal}>{total} г</span>
                </header>
                {meal && meal.items.length > 0 ? (
                  <ul className={styles.mealItems}>
                    {meal.items.map((item, index) => (
                      <li key={index} className={styles.mealItem}>
                        <span>{item.name}</span>
                        <span className={styles.mealItemWeight}>
                          {item.weight} {item.unit}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.empty}>Пусто</p>
                )}
              </section>
            )
          })}
          <footer className={styles.dayTotal}>
            Итого за день:{' '}
            {day?.meals.reduce(
              (sum, meal) => sum + meal.items.reduce((s, item) => s + item.weight, 0),
              0,
            ) ?? 0}{' '}
            г
          </footer>
        </section>

        <section className={styles.panel} aria-label="Шаблоны">
          <h2 className={styles.panelTitle}>Шаблоны</h2>
          <p className={styles.empty}>
            Шаблонов пока нет.
            <br />
            Шаблоны приёмов пищи — Фаза 2.
          </p>
        </section>
      </main>
    </div>
  )
}

export default App
