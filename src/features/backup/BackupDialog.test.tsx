import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { addProduct, db, exportBackup, listProducts } from '../../db/db'
import { BackupDialog } from './BackupDialog'

beforeEach(async () => {
  await db.delete()
  await db.open()
  // jsdom не умеет blob-URL и скачивание — заглушаем
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => 'blob:fake'),
    revokeObjectURL: vi.fn(),
  })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function makeFile(content: unknown): File {
  return new File([JSON.stringify(content)], 'backup.json', { type: 'application/json' })
}

describe('BackupDialog', () => {
  it('экспортирует данные в файл', async () => {
    const user = userEvent.setup()
    render(<BackupDialog onClose={() => undefined} />)

    await user.click(screen.getByRole('button', { name: 'Экспорт в файл' }))

    await screen.findByText('Файл резервной копии сохранён.')
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce()
  })

  it('импортирует резервную копию после подтверждения', async () => {
    await addProduct({ name: 'Старый продукт', defaultWeight: 100, unit: 'г' })
    const backup = await exportBackup()
    await db.products.clear()

    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(<BackupDialog onClose={() => undefined} />)

    await user.upload(screen.getByLabelText('Файл резервной копии'), makeFile(backup))

    await screen.findByText('Данные восстановлены из резервной копии.')
    const products = await listProducts()
    expect(products.map((p) => p.name)).toEqual(['Старый продукт'])
  })

  it('не импортирует без подтверждения', async () => {
    const backup = await exportBackup()
    await addProduct({ name: 'Не должен исчезнуть', defaultWeight: 100, unit: 'г' })

    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    render(<BackupDialog onClose={() => undefined} />)

    await user.upload(screen.getByLabelText('Файл резервной копии'), makeFile(backup))

    await waitFor(async () => expect(await listProducts()).toHaveLength(1))
    expect(screen.queryByText(/восстановлены/)).not.toBeInTheDocument()
  })

  it('отклоняет чужой файл с ошибкой', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(<BackupDialog onClose={() => undefined} />)

    await user.upload(
      screen.getByLabelText('Файл резервной копии'),
      makeFile({ something: 'else' }),
    )

    await screen.findByText('Файл не является резервной копией Food Tracker')
  })
})
