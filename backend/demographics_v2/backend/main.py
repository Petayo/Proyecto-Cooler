import os
import collector
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from collector import start_demographics_collector, get_events, get_total_count
import uvicorn
from datetime import datetime, timezone, timedelta

CAPTURES_DIR = "/home/ubuntu/rubikpi/captures"

app = FastAPI(
    title="Smart Fridge Vision API",
    description="Demographics + Can Detection API — Rubik Pi 3",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Endpoints ──────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"message": "Smart Fridge Vision API", "docs": "/docs"}

@app.get("/status")
def status():
    return {
        "status":                "running",
        "demographics_running":  collector.demographics_running,
        "can_detector_running":  False,
        "total_events":          get_total_count(),
        "rubikpi_ip":            "192.168.1.153",
        "port":                  8000,
    }

@app.get("/events")
def get_all_events(limit: int = 50):
    return {
        "events": get_events(limit=limit),
        "count":  get_total_count(),
    }

@app.get("/events/demographics")
def get_demographics_events(limit: int = 50):
    events = get_events(source="demographics", limit=limit)
    return {"events": events, "count": len(events)}

@app.get("/events/can")
def get_can_events(limit: int = 50):
    events = get_events(source="can_detector", limit=limit)
    return {"events": events, "count": len(events)}

@app.post("/events/can")
def receive_can_event(event: dict):
    """
    POST aquí con este formato:
    {
      "inventory": {"Coke": 2, "Apple Soda": 1, ...},
      "changes":   {"Coke": -1},
      "event_type": "item_removed",
      "total_objects": 10,
      "image_path": "can_20260511_162132.jpg"
    }
    """
    from collector import events_buffer, lock
    event["source"] = "can_detector"
    if "timestamp" not in event:
        event["timestamp"] = datetime.now(timezone.utc).isoformat()
    with lock:
        events_buffer.append(event)
    return {"status": "ok"}

@app.get("/events/summary")
def get_summary(minutes: int = 1):
    """Resumen de los últimos N minutos."""
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=minutes)
    with collector.lock:
        all_events = list(collector.events_buffer)

    recent = []
    for e in all_events:
        try:
            ts = datetime.fromisoformat(e["timestamp"])
            if ts >= cutoff:
                recent.append(e)
        except:
            pass

    total_detections = sum(len(e.get("detections", [])) for e in recent
                          if e.get("source") == "demographics")
    genders     = []
    age_groups  = []
    for e in recent:
        if e.get("source") == "demographics":
            for d in e.get("detections", []):
                genders.append(d.get("gender"))
                age_groups.append(d.get("age_group"))

    return {
        "period_minutes":   minutes,
        "total_frames":     len(recent),
        "total_detections": total_detections,
        "gender_breakdown": {
            "Male":   genders.count("Male"),
            "Female": genders.count("Female"),
        },
        "age_group_breakdown": {
            group: age_groups.count(group)
            for group in set(age_groups)
        },
        "events": recent,
    }

@app.get("/captures/{filename}")
def get_capture(filename: str):
    """Sirve imágenes capturadas para el frontend."""
    file_path = os.path.join(CAPTURES_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Imagen no encontrada")
    return FileResponse(file_path, media_type="image/jpeg")

@app.get("/captures")
def list_captures(limit: int = 20):
    """Lista las últimas N capturas disponibles."""
    if not os.path.exists(CAPTURES_DIR):
        return {"captures": []}
    files = sorted(os.listdir(CAPTURES_DIR), reverse=True)[:limit]
    return {
        "captures": [
            {
                "filename": f,
                "url": f"http://192.168.1.153:8000/captures/{f}"
            }
            for f in files if f.endswith(".jpg")
        ]
    }

# ── Arranque ───────────────────────────────────────────────────────────────────
@app.on_event("startup")
def startup():
    script_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "../scripts/demographics_json.py")
    )
    start_demographics_collector(script_path)
    print(f"✅ Backend listo en http://192.168.1.153:8000")
    print(f"📚 Docs en http://192.168.1.153:8000/docs")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
