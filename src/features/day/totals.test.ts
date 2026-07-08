import { describe, expect, it } from 'vitest'
import { dayTotal, mealTotal } from './totals'
import type { Day } from '../../types/models'

const day: Day = {
  date: '2026-06-01',
  updatedAt: '2026-06-01T10:00:00.000Z',
  meals: [
    {
      categoryId: 'breakfast',
      items: [
        { name: 'Овсянка', weight: 60, unit: 'г' },
        { name: 'Молоко', weight: 200, unit: 'мл' },
      ],
    },
    { categoryId: 'lunch', items: [{ name: 'Суп', weight: 350, unit: 'г' }] },
  ],
}

describe('итоги (US-10)', () => {
  it('суммарный вес по приёму пищи', () => {
    expect(mealTotal(day.meals[0])).toBe(260)
    expect(mealTotal(undefined)).toBe(0)
  })

  it('общий итог за день — сумма по всем приёмам', () => {
    expect(dayTotal(day)).toBe(610)
    expect(dayTotal(null)).toBe(0)
    expect(dayTotal({ date: '2026-06-02', meals: [], updatedAt: '' })).toBe(0)
  })
})
