# QA Report — Habits Dashboard Aggregation (2025-09-23)

## Scope
- Validate new `/api/v1/habits/dashboard` aggregator (habits+dailies+rewards+stats).
- Frontend HabitsModule refactor consuming dashboard payload with area/project/include_sub filters and Dailies/Rewards sections.

## Test Matrix
| Layer | Command | Result |
|-------|---------|--------|
| API   | `./venv/bin/pytest tests/web/test_habits_v1_api.py` | ✅ Pass (9 tests, 12.4s) |
| Web   | `cd web && npx vitest run components/habits/HabitsModule.test.tsx` | ✅ Pass (3 tests) |

## Findings
- Dashboard payload возвращает привычки/ежедневки/награды и уважает area/project/include_sub; проверено после обновления ck_*_single_container в БД.
- Frontend renders aggregated data, toggles habits, and preserves Telegram CTA behaviour in vitest coverage.
- Pydantic v2 deprecation warnings persist (known existing issue); no new warnings introduced.

## Manual Verification Checklist
- [ ] QA to smoke in staging: load `/habits`, toggle include_sub, verify Dailies/Rewards rendering with seeded data.
- [ ] Confirm rewards “Buy” flow still operates (not covered by automated UI tests).

## Status
Ready for TL Gate-4 review. No blockers.
