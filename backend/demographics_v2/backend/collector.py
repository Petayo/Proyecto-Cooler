import subprocess
import threading
import json
import time
from datetime import datetime, timezone
from collections import deque

# Buffer circular — guarda los últimos 1000 eventos
events_buffer: deque = deque(maxlen=1000)
demographics_running = False
lock = threading.Lock()

def start_demographics_collector(script_path: str):
    """Corre demographics_json.py como subprocess y lee su output JSON."""
    global demographics_running

    def _run():
        global demographics_running
        demographics_running = True
        print(f"🚀 Iniciando demographics collector: {script_path}")

        process = subprocess.Popen(
            ["python3", script_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            bufsize=1
        )

        for line in process.stdout:
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
                event = {
                    "timestamp": data.get("timestamp", datetime.now(timezone.utc).isoformat()),
                    "source":    "demographics",
                    "detections": data.get("detections", [])
                }
                with lock:
                    events_buffer.append(event)
            except json.JSONDecodeError:
                pass  # ignorar líneas que no son JSON

        demographics_running = False
        print("⚠️  Demographics collector terminó")

    t = threading.Thread(target=_run, daemon=True)
    t.start()

def get_events(source: str = None, limit: int = 50):
    """Retorna los últimos eventos, opcionalmente filtrados por source."""
    with lock:
        all_events = list(events_buffer)

    if source:
        all_events = [e for e in all_events if e.get("source") == source]

    return all_events[-limit:]

def get_total_count():
    with lock:
        return len(events_buffer)