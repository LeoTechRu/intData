from fastapi import APIRouter, Depends, Request
from fastapi.templating import Jinja2Templates
from models import User, Group, UserRole
from services.telegram import UserService
from sqlalchemy import select
from ..dependencies import role_required


templates = Jinja2Templates(directory="web/templates")

router = APIRouter(dependencies=[Depends(role_required(UserRole.admin))])


@router.get("/users")
async def list_users(request: Request):
    """Render a page with all registered users."""
    async with UserService() as service:
        result = await service.session.execute(select(User))
        users = result.scalars().all()
    return templates.TemplateResponse("admin/users.html", {"request": request, "users": users})


@router.post("/users/{telegram_id}/role")
async def change_user_role(telegram_id: int, role: UserRole):
    """Change the role of a user.

    Using a simple query/body parameter avoids the ``python-multipart``
    dependency which keeps tests lightweight."""
    async with UserService() as service:
        await service.update_user_role(telegram_id, role)
    return {"status": "ok"}


@router.get("/groups")
async def list_groups(request: Request):
    """Render a page with all groups and their members."""
    async with UserService() as service:
        result = await service.session.execute(select(Group))
        groups = result.scalars().all()
        groups_with_members = []
        for group in groups:
            members = await service.get_group_members(group.telegram_id)
            groups_with_members.append({"group": group, "members": members})
    return templates.TemplateResponse(
        "admin/groups.html", {"request": request, "groups": groups_with_members}
    )
