import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DndContext } from '@dnd-kit/core'
import type { ReactNode } from 'react'
import { addProduct, addProductToMeal, db, getDay, listCategories } from '../../db/db'
import { useAppSensors } from '../dnd/sensors'
import { shiftISODate, todayISO } from '../day/date'
import { HistoryPanel } from './HistoryPanel'

// сенсоры App: голый DndContext стартует drag на pointerdown и глотает клики
function Dnd({ children }: { children: ReactNode }) {
  return <DndContext sensors={useAppSensors()}>{children}</DndContext>
}

const OPEN = todayISO()
const YESTERDAY = shiftISODate(OPEN, -1)

beforeEach(async () => {
  await db.delete()
  await db.open()
})

async function seedYesterday() {
  const [breakfast] = await listCategories()
  const product = await addProduct({ name: 'Овсянка', defaultWeight: 60, unit: 'г' })
  await addProductToMeal(YESTERDAY, breakfast!.id, product)
  return breakfast!
}

function renderPanel() {
  render(
    <Dnd>
      <HistoryPanel openDate={OPEN} />
    </Dnd>,
  )
}

describe('HistoryPanel', () => {
  it('показывает вчерашний день по умолчанию (US-18)', async () => {
    await seedYesterday()
    renderPanel()

    await screen.findByText('Овсянка')
    expect(screen.getByRole('region', { name: 'История: Завтрак' })).toBeInTheDocument()
  })

  it('копирует продукт в открытый день тапом (US-26)', async () => {
    await seedYesterday()
    const user = userEvent.setup()
    renderPanel()

    await user.click(await screen.findByRole('button', { name: 'Скопировать в открытый день: Овсянка' }))

    await waitFor(async () => {
      const day = await getDay(OPEN)
      expect(day.meals[0]!.items[0]!.name).toBe('Овсянка')
    })
    // источник не изменился
    const source = await getDay(YESTERDAY)
    expect(source.meals[0]!.items).toHaveLength(1)
  })

  it('копирует весь день в открытый (US-26)', async () => {
    await seedYesterday()
    const user = userEvent.setup()
    renderPanel()

    await user.click(await screen.findByRole('button', { name: 'Копировать в текущий день' }))

    await waitFor(async () => {
      const day = await getDay(OPEN)
      expect(day.meals[0]!.items).toHaveLength(1)
    })
  })

  it('копирует отдельный приём пищи в открытый день (US-26)', async () => {
    await seedYesterday()
    const user = userEvent.setup()
    renderPanel()

    await user.click(
      await screen.findByRole('button', { name: 'Копировать приём в текущий день: Завтрак' }),
    )

    await waitFor(async () => {
      const day = await getDay(OPEN)
      expect(day.meals).toHaveLength(1)
      expect(day.meals[0]!.items[0]!.name).toBe('Овсянка')
    })
  })

  it('предупреждает, когда выбран открытый день', async () => {
    const user = userEvent.setup()
    renderPanel()

    // вчера → сегодня (= открытый день)
    await user.click(screen.getByRole('button', { name: 'История: день вперёд' }))

    await screen.findByText(/Это открытый день/)
    expect(screen.queryByRole('button', { name: 'Копировать в текущий день' })).not.toBeInTheDocument()
  })
})
