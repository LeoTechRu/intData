from fastapi import APIRouter

# Единый стабильный префикс для всего API
API_PREFIX = "/api/v1"
api_router = APIRouter()

#
# Подключаем ВСЕ feature-API под единый префикс.
# Каждая фича-страница (tasks, notes, …) в своих модулях
# уже экспонирует APIRouter с именем `api`.
# Если в каком-то модуле он назван иначе (например, router_api),
# можно добавить alias: `api = router_api`.
#
from .tasks import api as tasks_api
from .reminders import api as reminders_api
from .calendar import api as calendar_api
from .notes import api as notes_api
from .time_entries import api as time_api
from .areas import api as areas_api
from .projects import api as projects_api
from .resources import api as resources_api
from .inbox import api as inbox_api

# отдельные файлы в web/routes/api/*
from .api.admin import router as admin_api
from .api.admin_settings import router as admin_settings_api
from .api.app_settings import router as app_settings_api
from .api.auth_webapp import router as auth_webapp_api
from .api.user_favorites import router as user_favorites_api
from .api.integrations_google import router as gcal_api

# Монтирование под /api/v1
api_router.include_router(tasks_api, prefix="/tasks", tags=["tasks"])
api_router.include_router(reminders_api, prefix="/reminders", tags=["reminders"])
api_router.include_router(calendar_api, prefix="/calendar", tags=["calendar"])
api_router.include_router(notes_api, prefix="/notes", tags=["notes"])
api_router.include_router(time_api, prefix="/time", tags=["time"])
api_router.include_router(areas_api, prefix="/areas", tags=["areas"])
api_router.include_router(projects_api, prefix="/projects", tags=["projects"])
api_router.include_router(resources_api, prefix="/resources", tags=["resources"])
api_router.include_router(inbox_api, prefix="/inbox", tags=["inbox"])

api_router.include_router(admin_api, prefix="/admin", tags=["admin"])
api_router.include_router(admin_settings_api, prefix="/admin_settings", tags=["admin"])
api_router.include_router(app_settings_api, prefix="/app-settings", tags=["app-settings"])
api_router.include_router(auth_webapp_api, prefix="/auth", tags=["auth"])
api_router.include_router(user_favorites_api, prefix="/user", tags=["user"])
api_router.include_router(gcal_api, prefix="/integrations/google", tags=["integrations"])
