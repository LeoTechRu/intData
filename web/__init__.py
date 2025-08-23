"""Web application package for FastAPI endpoints."""
from fastapi import FastAPI
from .routes import admin

app = FastAPI()
app.include_router(admin.router, prefix="/admin")
