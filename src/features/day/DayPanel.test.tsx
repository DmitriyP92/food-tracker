import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DndContext } from '@dnd-kit/core'
import {
  addCategory,
  addProduct,
  addProductToMeal,
  db,
  getDay,
  listCategories,
} from '../../db/db'
import { DayPanel } from './DayPanel'

const DATE = '2026-06-01'

function renderPanel(onAddRequest = vi.fn()) {
  render(
    <DndContext>
      <DayPanel date={DATE} onAddRequest={onAddRequest} />
    </DndContext>,
  )
  return onAddRequest
}

beforeEach(async () => {
  await db.delete()
  await db.open()
})

async function seedMealItem() {
  const [breakfast] = await listCategories()
  const product = await addProduct({ name: 'Овсянка', defaultWeight: 60, unit: 'г' })
  await addProductToMeal(DATE, breakfast!.id, product)
  return breakfast!
}

describe('DayPanel', () => {
  it('показывает категории и добавленный продукт с итогами (US-10)', async () => {
    await seedMealItem()
    renderPanel()

    await screen.findByText('Овсянка')
    for (const name of ['Завтрак', 'Обед', 'Ужин']) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument()
    }
    expect(screen.getByText('Итого за день')).toBeInTheDocument()
    // 60 г — и в итоге завтрака, и в итоге дня
    expect(screen.getAllByText('60 г').length).toBeGreaterThanOrEqual(2)
  })

  it('меняет вес записи, не трогая библиотеку (US-8)', async () => {
    await seedMealItem()
    const user = userEvent.setup()
    renderPanel()

    const weightInput = await screen.findByLabelText('Вес: Овсянка')
    await user.clear(weightInput)
    await user.type(weightInput, '80')
    await user.tab() // blur → сохранение

    await waitFor(async () => {
      const day = await getDay(DATE)
      expect(day.meals[0]!.items[0]!.weight).toBe(80)
    })
  })

  it('убирает продукт из приёма (US-9)', async () => {
    await seedMealItem()
    const user = userEvent.setup()
    renderPanel()

    await user.click(await screen.findByRole('button', { name: 'Убрать: Овсянка' }))

    await waitFor(async () => {
      const day = await getDay(DATE)
      expect(day.meals).toHaveLength(0)
    })
  })

  it('добавляет пользовательскую категорию (US-13)', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(await screen.findByRole('button', { name: '＋ Категория' }))
    await user.type(screen.getByLabelText('Название категории'), 'Перекус')
    await user.click(screen.getByRole('button', { name: 'Добавить' }))

    await screen.findByRole('heading', { name: 'Перекус' })
    expect(await listCategories()).toHaveLength(4)
  })

  it('удаляет пустую пользовательскую категорию, дефолтные без крестика (US-13)', async () => {
    await addCategory('Перекус')
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    renderPanel()

    await screen.findByRole('heading', { name: 'Перекус' })
    // у дефолтных категорий кнопки удаления нет
    expect(screen.queryByRole('button', { name: 'Удалить категорию: Завтрак' })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Удалить категорию: Перекус' }))

    await waitFor(async () => expect(await listCategories()).toHaveLength(3))
  })

  it('кнопка «＋ Добавить» запрашивает шторку с категорией (US-6)', async () => {
    const user = userEvent.setup()
    const onAddRequest = renderPanel()

    const buttons = await screen.findAllByRole('button', { name: '＋ Добавить' })
    await user.click(buttons[0]!)

    expect(onAddRequest).toHaveBeenCalledTimes(1)
    expect(onAddRequest.mock.calls[0]![0]).toMatchObject({ name: 'Завтрак' })
  })
})
