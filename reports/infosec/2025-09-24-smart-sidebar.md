infosec_advisory:
  when_utc: "2025-09-24T11:03:00Z"
  initiative: E17 / SmartSidebar
  scope:
    - API `/api/v1/navigation/user-sidebar-layout`
    - API `/api/v1/navigation/global-sidebar-layout`
    - React SmartSidebar drag-and-drop (layout payload persistence)
  summary: |
    Проведён review новых REST эндпоинтов и фронтенд-логики сохранения layout. Основные риски связаны с
    нагрузкой на jsonb payload и возможностью злоупотребления drag-and-drop при отсутствии rate limiting.
    Благоприятных вариантов обхода авторизации не обнаружено, optimistic locking (version) работает корректно.
  findings:
    - id: SEC-SS-001
      severity: should
      component: API
      description: "Ограничить максимальное количество элементов в layout payload (JSON Schema) до 256 ключей, чтобы предотвратить DoS через большие массивы."
      recommendation: "Добавить в Pydantic схему max_items и соответствующую проверку на бэкенде."
    - id: SEC-SS-002
      severity: could
      component: Frontend
      description: "Mutation SaveUserLayout не обрабатывает 409 повторно — пользователь остаётся без UI уведомления."
      recommendation: "Показать toast и повторно загрузить snapshot при ответе 409, чтобы избежать рассинхрона."
    - id: SEC-SS-003
      severity: should
      component: Logging
      description: "Новые POST эндпоинты не логируют layout изменения (Diff / user_id)."
      recommendation: "Добавить аудит (info level) с user_id, scope, version_before/version_after."
  verification:
    - lint: "npm run lint"
    - unit: "npm run test -- ModuleTabs.test.tsx"
    - manual: |
        curl POST /api/v1/navigation/user-sidebar-layout (payload >512 items) -> 422 missing (ожидается после фикса).
        Спасибо за 409 тест (версия mismatch) — возвращает detail.currentVersion.
  conclusion: |
    Уязвимостей категории MUST не обнаружено. Требуется follow-up для size limits и аудита изменений. После фикса
    повторный advisory не требуется.
