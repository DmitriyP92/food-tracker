import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DndContext } from '@dnd-kit/core'
import type { ReactNode } from 'react'
import { db, addProduct, listProducts } from '../../db/db'
import { useAppSensors } from '../dnd/sensors'
import { LibraryPanel } from './LibraryPanel'

// Те же сенсоры, что в App: с голым DndContext (PointerSensor без порога)
// drag стартует прямо на pointerdown и глотает обычные клики
function Dnd({ children }: { children: ReactNode }) {
  return <DndContext sensors={useAppSensors()}>{children}</DndContext>
}

function renderPanel() {
  return render(
    <Dnd>
      <LibraryPanel />
    </Dnd>,
  )
}

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('LibraryPanel', () => {
  it('добавляет продукт через форму (US-1)', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByRole('button', { name: '＋ Продукт' }))
    await user.type(screen.getByLabelText('Название продукта'), 'Гречка')
    await user.type(screen.getByLabelText('Вес по умолчанию'), '100')
    await user.click(screen.getByRole('button', { name: 'Добавить' }))

    await screen.findByText('Гречка')
    expect(screen.getByText('100 г')).toBeInTheDocument()
    expect(await listProducts()).toHaveLength(1)
  })

  it('показывает ошибку при пустом названии', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByRole('button', { name: '＋ Продукт' }))
    await user.type(screen.getByLabelText('Вес по умолчанию'), '100')
    await user.click(screen.getByRole('button', { name: 'Добавить' }))

    await screen.findByText('Название продукта не может быть пустым')
    expect(await listProducts()).toHaveLength(0)
  })

  it('редактирует продукт по тапу (US-2)', async () => {
    await addProduct({ name: 'Творог', defaultWeight: 150, unit: 'г' })
    const user = userEvent.setup()
    renderPanel()

    await user.click(await screen.findByText('Творог'))
    const nameInput = screen.getByLabelText('Название продукта')
    await user.clear(nameInput)
    await user.type(nameInput, 'Творог 5%')
    await user.click(screen.getByRole('button', { name: 'Сохранить' }))

    await screen.findByText('Творог 5%')
    const products = await listProducts()
    expect(products[0]!.name).toBe('Творог 5%')
  })

  it('удаляет продукт (US-3)', async () => {
    await addProduct({ name: 'Кефир', defaultWeight: 250, unit: 'мл' })
    const user = userEvent.setup()
    renderPanel()

    await user.click(await screen.findByText('Кефир'))
    await user.click(screen.getByRole('button', { name: 'Удалить' }))

    await waitFor(async () => expect(await listProducts()).toHaveLength(0))
    expect(screen.queryByText('Кефир')).not.toBeInTheDocument()
  })
})
