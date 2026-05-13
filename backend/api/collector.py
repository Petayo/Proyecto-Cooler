import os
import subprocess
import threading
import time
import json
from datetime import datetime, timezone
from collections import deque

# Circular buffer to keep recent events in memory
EVENTS_BUFFER: deque = deque(maxlen=2000)
lock = threading.Lock()

demographics_running = False
can_detector_running = False


def _append_event(event: dict):
    if "timestamp" not in event:
        event["timestamp"] = datetime.now(timezone.utc).isoformat()
    with lock:
        EVENTS_BUFFER.append(event)


def _stream_lines(pipe, prefix: str):
    for raw in iter(pipe.readline, ""):
        line = raw.strip()
        if line:
            print(f"{prefix} {line}")


def start_demographics_collector(script_path: str):
    """Run demographics_json.py as a subprocess and read its JSON output."""
    global demographics_running

    def _run():
        global demographics_running
        demographics_running = True
        print(f"Starting demographics collector: {script_path}")

        env = os.environ.copy()

        process = subprocess.Popen(
            ["python3", script_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
            env=env,
        )

        stderr_thread = threading.Thread(
            target=_stream_lines,
            args=(process.stderr, "[demographics stderr]"),
            daemon=True,
        )
        stderr_thread.start()

        for line in process.stdout:
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
            except json.JSONDecodeError:
                continue

            event = {
                "timestamp": data.get("timestamp"),
                "source": "demographics",
                "image_path": data.get("image_path"),
                "detections": data.get("detections", []),
            }
            _append_event(event)

        process.wait()
        demographics_running = False
        print(f"Demographics collector stopped (exit code {process.returncode})")

    t = threading.Thread(target=_run, daemon=True)
    t.start()


def start_can_collector(script_path: str, startup_delay: float = 0):
    """Run can_inference.py with JSON output and store events."""
    global can_detector_running

    def _run():
        global can_detector_running
        if startup_delay:
            time.sleep(startup_delay)
        can_detector_running = True
        print(f"Starting can collector: {script_path}")

        env = os.environ.copy()
        env["CAN_OUTPUT_JSON"] = "1"

        process = subprocess.Popen(
            ["python3", script_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
            env=env,
        )

        stderr_thread = threading.Thread(
            target=_stream_lines,
            args=(process.stderr, "[can stderr]"),
            daemon=True,
        )
        stderr_thread.start()

        for line in process.stdout:
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
            except json.JSONDecodeError:
                continue

            event = {
                "timestamp": data.get("timestamp"),
                "source": "can_detector",
                "image_path": data.get("image_path"),
                "detections": data.get("detections", []),
            }
            _append_event(event)

        process.wait()
        can_detector_running = False
        print(f"Can collector stopped (exit code {process.returncode})")

    t = threading.Thread(target=_run, daemon=True)
    t.start()


def get_events(source: str | None = None, limit: int = 50):
    with lock:
        all_events = list(EVENTS_BUFFER)

    if source:
        all_events = [event for event in all_events if event.get("source") == source]

    return all_events[-limit:]


def get_total_count():
    with lock:
        return len(EVENTS_BUFFER)
