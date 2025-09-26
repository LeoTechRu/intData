# Habits Expansion Plan — Dailies & Rewards (2025-09-23)

## Scope
TL-2025-09-23-habits-dailies-rewards (E16). Expand `/habits` to expose all habit primitives:
- Habit cards (existing), Daily routines (RRULE-based), Rewards store.
- Project/Area filters with include_sub flag.
- HUD improvements (HP/XP/Level/Gold/KP).

## Backend To-Dos
1. **Service layer**: confirm `backend/services/habits_service.py` exists; extend to fetch combined payload: habits, dailies, rewards, stats.
2. **API**:
   - GET `/api/v1/habits/dashboard?area_id=&project_id=&include_sub=` returns sections `{ habits: [], dailies: [], rewards: [], stats }`.
   - Support POST/PUT for dailies/rewards endpoints if not already (validate project/area inheritance).
   - Add filters for include_sub to propagate to queries.
3. **Cron**: ensure existing cron API returns updated stats after toggles (refetch pipeline already handles this).
4. **Tests**:
   - Extend pytest suite (`tests/web/test_habits_api.py`) for new dashboard payload and filters.
   - Add coverage for include_sub and project inheritance.

## Frontend To-Dos
1. **Types/hooks**: update / create `useHabitsDashboard` hook to fetch aggregated payload.
2. **HabitsModule UI**:
   - Restructure page into three columns: Habits, Dailies, Rewards (Tasks board remains optional reference).
   - Card components for each entity: actions (up/down/done/buy), progress, area/project tags.
   - Filters: area select (tree), project select (filtered), `include_sub` toggle, search.
   - HUD component showing stats.
3. **State management**: use React Query with invalidation on mutate; handle optimistic updates similar to existing toggle.
4. **Error UX**: show Telegram linking hints, cooldown messages for all actions.
5. **Tests**: update `web/components/habits/HabitsModule.test.tsx` with new layout, API mocks.

## Docs
- README (E16) Tasklist stays unchecked until merged; update sections describing UI once ready.
- Conventions (Habits) if new patterns introduced.

## Risks / Notes
- Ensure backend pagination/performance acceptable (consider limit if needed).
- Confirm API compatibility with bot flows; avoid breaking existing endpoints.
- Need sample data for tests (fixtures) covering habits/dailies/rewards and area/project combos.

## Next Steps
1. Audit backend services/routers for habits to confirm existing endpoints and data shapes.
2. Prototype API aggregator `/habits/dashboard` with include_sub support.
3. Update frontend fetcher and layout incrementally, verifying with vitest/RTL and manual QA.
