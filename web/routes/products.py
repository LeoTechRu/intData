from __future__ import annotations

from fastapi import APIRouter

# Легаси-UI перенесён в Next.js (web/app/products/*).
# API для продуктов формируется через /api/v1/profiles/products (см. web/routes/api_profiles.py).
# Здесь оставляем заглушку на случай будущих хендлеров, чтобы include_router не ломал импорт.

api = APIRouter(prefix="/products", tags=["products"])
