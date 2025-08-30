import os
from http.cookies import SimpleCookie

from starlette.responses import Response

# Ensure required env vars for web.config
os.environ.setdefault("TELEGRAM_BOT_TOKEN", "TEST")
os.environ.setdefault("BOT_USERNAME", "testbot")

from web.security.cookies import set_auth_cookies  # noqa: E402


def test_set_auth_cookies_sets_values_and_flags():
    resp = Response()
    set_auth_cookies(resp, web_user_id=10, telegram_id=20)
    jar = SimpleCookie()
    for header in resp.headers.getlist("set-cookie"):
        jar.load(header)
    assert jar["web_user_id"].value == "10"
    assert jar["telegram_id"].value == "20"
    for key in ("web_user_id", "telegram_id"):
        cookie = jar[key]
        assert cookie["path"] == "/"
        assert cookie["httponly"]
        assert cookie["samesite"].lower() == "lax"
