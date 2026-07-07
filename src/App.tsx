import { useState } from 'react'
import { DndContext, DragOverlay, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import type { Category, MealItem, Product } from './types/models'
import { addItemToMeal, addProductToMeal } from './db/db'
import { useAppSensors } from './features/dnd/sensors'
import { shiftISODate, todayISO } from './features/day/date'
import { DayPanel } from './features/day/DayPanel'
import { CardGhost, LibraryPanel } from './features/library/LibraryPanel'
import { LibrarySheet } from './features/library/LibrarySheet'
import { TemplatesPanel } from './features/templates/TemplatesPanel'
import { HistoryPanel } from './features/history/HistoryPanel'
import { BackupDialog } from './features/backup/BackupDialog'
import styles from './App.module.css'

type Dragged = { name: string; weight: number; unit: string }

function App() {
  const [date, setDate] = useState(todayISO)
  const [sheetCategory, setSheetCategory] = useState<Category | null>(null)
  const [backupOpen, setBackupOpen] = useState(false)
  const [rightTab, setRightTab] = useState<'templates' | 'history'>('templates')
  const [dragged, setDragged] = useState<Dragged | null>(null)

  const sensors = useAppSensors()

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current
    const product = data?.product as Product | undefined
    const item = data?.item as MealItem | undefined
    if (product)
      setDragged({ name: product.name, weight: product.defaultWeight, unit: product.unit })
    else if (item) setDragged({ name: item.name, weight: item.weight, unit: item.unit })
    else setDragged(null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setDragged(null)
    const category = event.over?.data.current?.category as Category | undefined
    if (!category) return
    const data = event.active.data.current
    const product = data?.product as Product | undefined
    const item = data?.item as MealItem | undefined
    // Дата назначения = открытый день (US-7, US-25); всё копируется как snapshot
    if (product) void addProductToMeal(date, category.id, product)
    else if (item) void addItemToMeal(date, category.id, { ...item })
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
            <input
              type="date"
              className={styles.dateInput}
              aria-label="Выбрать дату"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
            />
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

          <section
            className={styles.panel}
            aria-label={rightTab === 'templates' ? 'Шаблоны' : 'История'}
          >
            <div className={styles.tabs} role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={rightTab === 'templates'}
                className={rightTab === 'templates' ? styles.tabActive : styles.tab}
                onClick={() => setRightTab('templates')}
              >
                Шаблоны
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={rightTab === 'history'}
                className={rightTab === 'history' ? styles.tabActive : styles.tab}
                onClick={() => setRightTab('history')}
              >
                История
              </button>
            </div>
            {rightTab === 'templates' ? (
              <TemplatesPanel date={date} />
            ) : (
              <HistoryPanel openDate={date} />
            )}
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

        <DragOverlay>{dragged && <CardGhost {...dragged} />}</DragOverlay>
      </div>
    </DndContext>
  )
}

export default App
