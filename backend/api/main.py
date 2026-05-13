import os
from datetime import datetime, timezone, timedelta
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import collector
import uvicorn

CAPTURES_DIR = os.environ.get("CAPTURES_DIR", "/home/ubuntu/smart-cooler/captures")
DEFAULT_HOST = os.environ.get("EDGE_HOST", "192.168.1.153")
DEFAULT_PORT = int(os.environ.get("EDGE_PORT", "8000"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    demographics_script = os.path.join(
        base_dir, "demographics_v2", "scripts", "demographics_json.py"
    )
    can_script = os.path.join(
        base_dir, "can_detector_v1", "scripts", "can_inference.py"
    )

    collector.start_demographics_collector(demographics_script)
    collector.start_can_collector(can_script, startup_delay=3.0)

    print(f"Backend ready at http://{DEFAULT_HOST}:{DEFAULT_PORT}")
    print(f"Docs at http://{DEFAULT_HOST}:{DEFAULT_PORT}/docs")

    yield


app = FastAPI(
    title="Smart Cooler API",
    description="Demographics + Can Detection API — Rubik Pi 3",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _with_image_url(event: dict, request: Request):
    if not event:
        return event

    image_path = event.get("image_path")
    if not image_path:
        return event

    base = str(request.base_url).rstrip("/")
    event = {**event}
    event["image_url"] = f"{base}/captures/{image_path}"
    return event


@app.get("/")
def root():
    return {"message": "Smart Cooler API", "docs": "/docs"}


@app.get("/status")
def status():
    return {
        "status": "running",
        "demographics_running": collector.demographics_running,
        "can_detector_running": collector.can_detector_running,
        "total_events": collector.get_total_count(),
        "rubikpi_ip": DEFAULT_HOST,
        "port": DEFAULT_PORT,
    }


@app.get("/events")
def get_all_events(request: Request, limit: int = 50):
    events = collector.get_events(limit=limit)
    events = [_with_image_url(event, request) for event in events]
    return {"events": events, "count": len(events)}


@app.get("/events/demographics")
def get_demographics_events(request: Request, limit: int = 50):
    events = collector.get_events(source="demographics", limit=limit)
    events = [_with_image_url(event, request) for event in events]
    return {"events": events, "count": len(events)}


@app.get("/events/can")
def get_can_events(request: Request, limit: int = 50):
    events = collector.get_events(source="can_detector", limit=limit)
    events = [_with_image_url(event, request) for event in events]
    return {"events": events, "count": len(events)}


@app.get("/demographics/latest")
def get_latest_demographics_event(request: Request):
    events = collector.get_events(source="demographics", limit=1)
    latest = events[-1] if events else None
    if latest:
        latest = _with_image_url(latest, request)
    return {"event": latest}


@app.get("/can/latest")
def get_latest_can_event(request: Request):
    events = collector.get_events(source="can_detector", limit=1)
    latest = events[-1] if events else None
    if latest:
        latest = _with_image_url(latest, request)
    return {"event": latest}


@app.get("/events/summary")
def get_summary(minutes: int = 1):
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=minutes)
    all_events = collector.get_events(limit=1000)

    recent = []
    for event in all_events:
        try:
            ts = datetime.fromisoformat(event["timestamp"])
            if ts >= cutoff:
                recent.append(event)
        except Exception:
            pass

    total_demographics = sum(
        len(event.get("detections", []))
        for event in recent
        if event.get("source") == "demographics"
    )

    total_can = sum(
        len(event.get("detections", []))
        for event in recent
        if event.get("source") == "can_detector"
    )

    return {
        "period_minutes": minutes,
        "total_frames": len(recent),
        "demographics_detections": total_demographics,
        "can_detections": total_can,
        "events": recent,
    }


@app.get("/captures/{filename}")
def get_capture(filename: str):
    safe_name = os.path.basename(filename)
    file_path = os.path.join(CAPTURES_DIR, safe_name)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(file_path, media_type="image/jpeg")


@app.get("/captures")
def list_captures(request: Request, limit: int = 20):
    if not os.path.exists(CAPTURES_DIR):
        return {"captures": []}

    files = sorted(os.listdir(CAPTURES_DIR), reverse=True)[:limit]
    base = str(request.base_url).rstrip("/")

    captures = []
    for file_name in files:
        if not file_name.endswith(".jpg"):
            continue
        item = {"filename": file_name}
        if base:
            item["url"] = f"{base}/captures/{file_name}"
        captures.append(item)

    return {"captures": captures}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=DEFAULT_PORT, reload=False)
