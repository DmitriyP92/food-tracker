import { useState } from 'react'
import { DndContext, DragOverlay, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import type { Category, Product } from './types/models'
import { addProductToMeal } from './db/db'
import { useAppSensors } from './features/dnd/sensors'
import { shiftISODate, todayISO } from './features/day/date'
import { DayPanel } from './features/day/DayPanel'
import { LibraryPanel, ProductCardGhost } from './features/library/LibraryPanel'
import { LibrarySheet } from './features/library/LibrarySheet'
import { TemplatesPanel } from './features/templates/TemplatesPanel'
import { BackupDialog } from './features/backup/BackupDialog'
import styles from './App.module.css'

function App() {
  const [date, setDate] = useState(todayISO)
  const [sheetCategory, setSheetCategory] = useState<Category | null>(null)
  const [backupOpen, setBackupOpen] = useState(false)
  const [draggedProduct, setDraggedProduct] = useState<Product | null>(null)

  const sensors = useAppSensors()

  const handleDragStart = (event: DragStartEvent) => {
    const product = event.active.data.current?.product as Product | undefined
    setDraggedProduct(product ?? null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggedProduct(null)
    const product = event.active.data.current?.product as Product | undefined
    const category = event.over?.data.current?.category as Category | undefined
    if (product && category) {
      // Дата назначения = открытый день (US-7); вес — по умолчанию из библиотеки
      void addProductToMeal(date, category.id, product)
    }
  }

  const isToday = date === todayISO()

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className={styles.app}>
        <header className={styles.header}>
          <h1 className={styles.title}>Дневник питания</h1>
          <button
            type="button"
            className={styles.backupButton}
            aria-label="Резервная копия"
            title="Резервная копия"
            onClick={() => setBackupOpen(true)}
          >
            ⛃
          </button>
          <nav className={styles.dateNav} aria-label="Навигация по дням">
            <button
              type="button"
              aria-label="Предыдущий день"
              onClick={() => setDate((d) => shiftISODate(d, -1))}
            >
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
            <button
              type="button"
              aria-label="Следующий день"
              onClick={() => setDate((d) => shiftISODate(d, 1))}
            >
              ›
            </button>
          </nav>
        </header>

        <main className={styles.layout}>
          <section className={styles.panel} aria-label="Библиотека продуктов">
            <h2 className={styles.panelTitle}>Библиотека</h2>
            <LibraryPanel />
          </section>

          <section className={`${styles.panel} ${styles.dayPanel}`} aria-label="Дневник дня">
            <DayPanel date={date} onAddRequest={setSheetCategory} />
          </section>

          <section className={styles.panel} aria-label="Шаблоны">
            <h2 className={styles.panelTitle}>Шаблоны</h2>
            <TemplatesPanel date={date} />
          </section>
        </main>

        {backupOpen && <BackupDialog onClose={() => setBackupOpen(false)} />}

        {sheetCategory && (
          <LibrarySheet
            date={date}
            category={sheetCategory}
            onClose={() => setSheetCategory(null)}
          />
        )}

        <DragOverlay>{draggedProduct && <ProductCardGhost product={draggedProduct} />}</DragOverlay>
      </div>
    </DndContext>
  )
}

export default App
