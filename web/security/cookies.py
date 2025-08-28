"""Helpers for setting authentication cookies consistently."""
from fastapi import Response

from web.config import S


def set_auth_cookies(
    response: Response,
    web_user_id: int | str | None = None,
    telegram_id: int | str | None = None,
) -> Response:
    """Attach auth cookies with unified parameters.

    Parameters
    ----------
    response: Response
        Response object to mutate.
    web_user_id: int | str | None
        Web user identifier to store in ``web_user_id`` cookie.
    telegram_id: int | str | None
        Telegram identifier to store in ``telegram_id`` cookie.
    """
    if web_user_id is not None:
        response.set_cookie(
            "web_user_id",
            str(web_user_id),
            max_age=S.SESSION_MAX_AGE,
            path="/",
            httponly=True,
            samesite="lax",
        )
    if telegram_id is not None:
        response.set_cookie(
            "telegram_id",
            str(telegram_id),
            max_age=S.SESSION_MAX_AGE,
            path="/",
            httponly=True,
            samesite="lax",
        )
    return response
