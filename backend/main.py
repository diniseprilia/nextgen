"""Minimal FastAPI backend for Substrait: GET /health on port 8000, API under /api."""
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="NextGen")


class Health(BaseModel):
    status: str


@app.get("/health", response_model=Health)
def health():
    return {"status": "ok"}


@app.get("/api/health", response_model=Health)
def api_health():
    return {"status": "ok"}
