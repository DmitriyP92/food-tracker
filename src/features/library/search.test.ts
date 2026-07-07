import { describe, expect, it } from 'vitest'
import { filterProducts } from './search'
import type { Product } from '../../types/models'

const make = (name: string): Product => ({
  id: name,
  name,
  defaultWeight: 100,
  unit: 'г',
  createdAt: '',
  updatedAt: '',
})

const products = [make('Творог нежирный'), make('Сыр плавленый'), make('Смородина')]

describe('поиск по библиотеке (US-5)', () => {
  it('ищет по части названия без учёта регистра', () => {
    expect(filterProducts(products, 'сыр').map((p) => p.name)).toEqual(['Сыр плавленый'])
    expect(filterProducts(products, 'ТВОРОГ').map((p) => p.name)).toEqual(['Творог нежирный'])
    expect(filterProducts(products, 'оро').map((p) => p.name)).toEqual([
      'Творог нежирный',
      'Смородина',
    ])
  })

  it('пустой запрос и пробелы возвращают всё', () => {
    expect(filterProducts(products, '')).toHaveLength(3)
    expect(filterProducts(products, '   ')).toHaveLength(3)
  })

  it('без совпадений — пустой список', () => {
    expect(filterProducts(products, 'банан')).toHaveLength(0)
  })
})
