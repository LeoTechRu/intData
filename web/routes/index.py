from fastapi import APIRouter
from fastapi.responses import RedirectResponse

router = APIRouter()


@router.get("/", include_in_schema=False)
async def index():
    """Entry point redirects to the dashboard."""
    return RedirectResponse("/start")

@router.get("/admin", include_in_schema=False)
async def admin_index():
    return RedirectResponse("/admin/users")
