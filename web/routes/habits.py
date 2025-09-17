from fastapi import APIRouter, Depends, status
from fastapi.responses import RedirectResponse

from core.auth.owner import OwnerCtx, get_current_owner
from .index import render_next_page

ui_router = APIRouter(prefix="/habits", tags=["habits"], include_in_schema=False)


@ui_router.get("")
async def habits_page(
    owner: OwnerCtx | None = Depends(get_current_owner),
):
    if owner is None:
        # redirect anonymous users to /auth, keeping status explicit
        return RedirectResponse("/auth", status_code=status.HTTP_302_FOUND)
    return render_next_page("habits")
