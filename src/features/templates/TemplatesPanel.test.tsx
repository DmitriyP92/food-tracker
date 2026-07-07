import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db, getDay, listCategories, listTemplates, saveTemplate } from '../../db/db'
import { TemplatesPanel } from './TemplatesPanel'

const DATE = '2026-06-01'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

async function seedTemplate() {
  const [breakfast] = await listCategories()
  return saveTemplate({
    name: 'Утро',
    categoryId: breakfast!.id,
    items: [
      { name: 'Каша', weight: 200, unit: 'г' },
      { name: 'Кофе', weight: 250, unit: 'мл' },
    ],
  })
}

describe('TemplatesPanel', () => {
  it('показывает шаблоны по категориям со сводкой', async () => {
    await seedTemplate()
    render(<TemplatesPanel date={DATE} />)

    await screen.findByText('Утро')
    expect(screen.getByText('2 прод. · 450 г')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Шаблоны: Завтрак' })).toBeInTheDocument()
  })

  it('применяет шаблон к открытому дню (US-15)', async () => {
    await seedTemplate()
    const user = userEvent.setup()
    render(<TemplatesPanel date={DATE} />)

    await user.click(await screen.findByRole('button', { name: 'Применить' }))

    await waitFor(async () => {
      const day = await getDay(DATE)
      expect(day.meals[0]!.items).toHaveLength(2)
    })
  })

  it('редактирует состав шаблона (US-17)', async () => {
    await seedTemplate()
    const user = userEvent.setup()
    render(<TemplatesPanel date={DATE} />)

    await user.click(await screen.findByRole('button', { name: 'Изменить шаблон: Утро' }))
    await user.click(screen.getByRole('button', { name: 'Убрать из шаблона: Кофе' }))

    await waitFor(async () => {
      const [template] = await listTemplates()
      expect(template!.items).toHaveLength(1)
      expect(template!.items[0]!.name).toBe('Каша')
    })
  })

  it('удаляет шаблон (US-17)', async () => {
    await seedTemplate()
    const user = userEvent.setup()
    render(<TemplatesPanel date={DATE} />)

    await user.click(await screen.findByRole('button', { name: 'Изменить шаблон: Утро' }))
    await user.click(screen.getByRole('button', { name: 'Удалить шаблон' }))

    await waitFor(async () => expect(await listTemplates()).toHaveLength(0))
    await screen.findByText(/Шаблонов пока нет/)
  })
})
