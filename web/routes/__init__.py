from fastapi import APIRouter

api_router = APIRouter()

#
# Подключаем ВСЕ feature-API под единый префикс.
# Каждая фича-страница (tasks, notes, …) в своих модулях
# уже экспонирует APIRouter с именем `api`.
# Если в каком-то модуле он назван иначе (например, router_api),
# можно добавить alias: `api = router_api`.
#
from .tasks import api as tasks_api
from .calendar import api as calendar_api
from .alarms import api as alarms_api
from .notes import api as notes_api
from .time_entries import api as time_api
from .areas import api as areas_api
from .projects import api as projects_api
from .resources import api as resources_api
from .inbox import api as inbox_api
from .groups import api as groups_api
from .api_user_settings import router as user_settings_api

# отдельные файлы в web/routes/api/*
from .api.admin import router as admin_api
from .api.admin_settings import router as admin_settings_api
from .api.app_settings import router as app_settings_api
from .api.auth_webapp import router as auth_webapp_api
from .api.user_favorites import router as user_favorites_api
from .api.integrations_google import router as gcal_api
from .api.habits_v1 import api as habits_v1_api
from .api.diagnostics import router as diagnostics_api

api_router.include_router(tasks_api)
api_router.include_router(calendar_api)
api_router.include_router(alarms_api)
api_router.include_router(notes_api)
api_router.include_router(time_api)
api_router.include_router(areas_api)
api_router.include_router(projects_api)
api_router.include_router(resources_api)
api_router.include_router(inbox_api)
api_router.include_router(groups_api)
api_router.include_router(admin_api)
api_router.include_router(admin_settings_api)
api_router.include_router(app_settings_api)
api_router.include_router(auth_webapp_api)
api_router.include_router(user_favorites_api)
api_router.include_router(gcal_api)
api_router.include_router(user_settings_api)
api_router.include_router(habits_v1_api)
api_router.include_router(diagnostics_api)
