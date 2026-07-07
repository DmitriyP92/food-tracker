# Food Tracker — Дневник питания

Личное офлайн-приложение (PWA) для трекинга питания: дневник приёмов пищи
с переиспользуемой библиотекой продуктов, drag & drop, шаблонами и историей.
Все данные хранятся только на устройстве (IndexedDB), сеть нужна лишь для
установки и обновления.

**Приложение:** https://dmitriyp92.github.io/food-tracker/
(установка на iOS: Safari → «Поделиться» → «На экран Домой»)

## Возможности

- Библиотека продуктов (название, вес по умолчанию, единица) с поиском
- Дневник по датам: drag & drop на iPad, тап-добавление через шторку на iPhone
- Категории приёмов пищи: Завтрак/Обед/Ужин + свои, перетаскивание порядка
- Шаблоны приёмов (до 10 на категорию), применяются как редактируемая копия
- История: просмотр любого дня, перенос еды в открытый день (drag / тап / приём / день целиком), «Скопировать вчера»
- Итоги по приёму и за день (по весу)
- Резервная копия: экспорт/импорт всех данных в JSON
- Полностью офлайн, тёмная тема, русский интерфейс

## Стек

React + TypeScript (strict) · Vite · Dexie (IndexedDB) · dnd-kit ·
vite-plugin-pwa (Workbox) · CSS Modules · Vitest · Playwright

Подробности архитектуры и правила проекта — в [CLAUDE.md](CLAUDE.md),
требования — в [docs/PRD.md](docs/PRD.md).

## Команды

```bash
npm run dev      # dev-сервер (http://localhost:5173/food-tracker/)
npm run build    # прод-сборка (tsc + vite build + service worker)
npm run preview  # локальный просмотр прод-сборки
npm test         # unit/компонентные тесты (Vitest)
npm run e2e      # E2E (Playwright, WebKit: iPad + iPhone)
npm run lint     # ESLint
npm run format   # Prettier
```

## Деплой

Каждый пуш в `main` собирает и публикует приложение на GitHub Pages
(`.github/workflows/deploy.yml`): lint → тесты → сборка → деплой.
