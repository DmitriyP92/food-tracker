// Общий setup Vitest: IndexedDB-полифилл для тестов слоя данных,
// матчеры jest-dom и размонтирование React-деревьев между тестами.
import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(cleanup)
