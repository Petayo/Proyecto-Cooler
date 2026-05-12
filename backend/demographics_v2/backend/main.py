import os
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

from collector import (
    start_demographics_collector,
    get_events,
    get_total_count,
)
import collector

# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Smart Fridge Vision API",
    description="Demographics + Can Detection API running on Rubik Pi 3",
    version="1.0.0"
)

# CORS — permite que cualquier frontend en la red local consuma la API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Rutas ──────────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"message": "Smart Fridge Vision API", "docs": "/docs"}

@app.get("/status")
def status():
    return {
        "status":                "running",
        "demographics_running":  collector.demographics_running,
        "can_detector_running":  False,  # se activa cuando tu compañero integre
        "total_events":          get_total_count(),
        "rubikpi_ip":            "192.168.1.153",
        "port":                  8000,
    }

@app.get("/events")
def get_all_events(limit: int = 50):
    """Últimos N eventos de todos los modelos."""
    return {
        "events": get_events(limit=limit),
        "count":  get_total_count(),
    }

@app.get("/events/demographics")
def get_demographics_events(limit: int = 50):
    """Últimos N eventos solo de demographics."""
    events = get_events(source="demographics", limit=limit)
    return {
        "events": events,
        "count":  len(events),
    }

@app.get("/events/can")
def get_can_events(limit: int = 50):
    """Últimos N eventos solo del detector de latas — placeholder para tu compañero."""
    events = get_events(source="can_detector", limit=limit)
    return {
        "events": events,
        "count":  len(events),
    }

@app.post("/events/can")
def receive_can_event(event: dict):
    """
    Endpoint para que el detector de latas mande eventos.
    Tu compañero hace POST aquí con su JSON.
    """
    from collector import events_buffer, lock
    from datetime import datetime, timezone
    event["source"] = "can_detector"
    if "timestamp" not in event:
        event["timestamp"] = datetime.now(timezone.utc).isoformat()
    with lock:
        events_buffer.append(event)
    return {"status": "ok"}

# ── Arranque ───────────────────────────────────────────────────────────────────
@app.on_event("startup")
def startup():
    script_path = os.path.join(
        os.path.dirname(__file__),
        "../scripts/demographics_json.py"
    )
    script_path = os.path.abspath(script_path)
    start_demographics_collector(script_path)
    print(f"✅ Backend listo en http://192.168.1.153:8000")
    print(f"📚 Docs en http://192.168.1.153:8000/docs")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)