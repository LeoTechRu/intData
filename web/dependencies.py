from fastapi import Depends, HTTPException, status
from models import User, UserRole


async def get_current_user() -> User:
    """Return the current user. In a real application this would pull
    the user from the request/session. Here we provide a placeholder
    admin user so that the dependency can be used in examples."""
    return User(telegram_id=0, first_name="Admin", role=UserRole.admin.value)


def role_required(required_role: UserRole):
    """Dependency factory ensuring the current user has the given role."""

    async def verifier(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role < required_role.value:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    return verifier
