import os
import time
import threading
import json
import numpy as np
import cv2
import onnxruntime as ort
from datetime import datetime, timezone
import uuid

# ── Configuration ─────────────────────────────────────────────────────────────
CAPTURES_DIR = "/home/ubuntu/smart-cooler/captures"
MODEL_PATH = "/home/ubuntu/smart-cooler/demographics_v2/models_cpu/age_gender/age_gender_modern.onnx"
FACE_PROTO = (
    "/home/ubuntu/smart-cooler/demographics_v2/models_cpu/face_detector/deploy.prototxt"
)
FACE_WEIGHTS = "/home/ubuntu/smart-cooler/demographics_v2/models_cpu/face_detector/res10_300x300_ssd_iter_140000.caffemodel"
MAX_CAPTURE_AGE_H = 2  # delete captures older than N hours

INPUT_H, INPUT_W = 224, 224
AGE_BIAS = -7
GENDER_HISTORY = 10

MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32).reshape(3, 1, 1)
STD = np.array([0.229, 0.224, 0.225], dtype=np.float32).reshape(3, 1, 1)

def _resolve_camera_source():
    source = os.environ.get(
        "DEMO_CAMERA_SOURCE", os.environ.get("DEMO_CAMERA_INDEX", "/dev/video2")
    )
    return source


def _build_gstreamer_pipeline(source):
    return (
        f"v4l2src device={source} ! "
        "image/jpeg,width=1280,height=720,framerate=30/1 ! "
        "jpegdec ! videoconvert ! "
        "video/x-raw,format=BGR ! "
        "appsink drop=true max-buffers=1 sync=false"
    )

os.environ["XDG_RUNTIME_DIR"] = "/run/user/1000"
os.environ["WAYLAND_DISPLAY"] = "wayland-1"
os.makedirs(CAPTURES_DIR, exist_ok=True)

AGE_GROUPS = [
    (0, 12, "0-12"),
    (13, 17, "13-17"),
    (18, 24, "18-24"),
    (25, 32, "25-32"),
    (33, 45, "33-45"),
    (46, 60, "46-60"),
    (61, 100, "61+"),
]


def age_to_group(age):
    for lo, hi, label in AGE_GROUPS:
        if lo <= age <= hi:
            return label
    return f"{age}"


# ── Cleanup old captures ─────────────────────────────────────────────────────-
def cleanup_old_captures():
    now = time.time()
    cutoff = MAX_CAPTURE_AGE_H * 3600
    for fname in os.listdir(CAPTURES_DIR):
        fpath = os.path.join(CAPTURES_DIR, fname)
        if os.path.isfile(fpath) and (now - os.path.getmtime(fpath)) > cutoff:
            os.remove(fpath)


# ── Load models ─────────────────────────────────────────────────────────────--
print("Loading models...", flush=True)
session = ort.InferenceSession(MODEL_PATH, providers=["CPUExecutionProvider"])
face_net = cv2.dnn.readNetFromCaffe(FACE_PROTO, FACE_WEIGHTS)
print("Models loaded", flush=True)

dummy = np.zeros((1, 3, INPUT_H, INPUT_W), dtype=np.float32)
session.run(None, {"pixel_values": dummy})
print("Warm-up completed\n", flush=True)

# ── Shared state ─────────────────────────────────────────────────────────────-
state = {
    "frame": None,
    "running": True,
    "gender_hist": {},
    "lock": threading.Lock(),
}


# ── Face detector ─────────────────────────────────────────────────────────────
def detect_faces(frame):
    h, w = frame.shape[:2]
    blob = cv2.dnn.blobFromImage(
        cv2.resize(frame, (300, 300)), 1.0, (300, 300), (104.0, 177.0, 123.0)
    )
    face_net.setInput(blob)
    dets = face_net.forward()

    faces = []
    for i in range(dets.shape[2]):
        conf = dets[0, 0, i, 2]
        if conf < 0.7:
            continue
        x1 = int(dets[0, 0, i, 3] * w)
        y1 = int(dets[0, 0, i, 4] * h)
        x2 = int(dets[0, 0, i, 5] * w)
        y2 = int(dets[0, 0, i, 6] * h)
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(w, x2), min(h, y2)
        if x2 > x1 and y2 > y1:
            faces.append((conf, x1, y1, x2, y2))

    if not faces:
        return []

    faces.sort(reverse=True)

    def iou(a, b):
        ix1 = max(a[1], b[1])
        iy1 = max(a[2], b[2])
        ix2 = min(a[3], b[3])
        iy2 = min(a[4], b[4])
        inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)
        area_a = (a[3] - a[1]) * (a[4] - a[2])
        area_b = (b[3] - b[1]) * (b[4] - b[2])
        union = area_a + area_b - inter
        return inter / union if union > 0 else 0

    kept = []
    for f in faces:
        if all(iou(f, k) < 0.4 for k in kept):
            kept.append(f)

    result = []
    for _, x1, y1, x2, y2 in kept:
        pad = int((y2 - y1) * 0.1)
        x1 = max(0, x1 - pad)
        y1 = max(0, y1 - pad)
        x2 = min(frame.shape[1], x2 + pad)
        y2 = min(frame.shape[0], y2 + pad)
        result.append((x1, y1, x2, y2))
    return result


# ── Inference ─────────────────────────────────────────────────────────────────
def predict(face_crop, face_key):
    img = cv2.cvtColor(face_crop, cv2.COLOR_BGR2RGB)
    img = cv2.resize(img, (INPUT_W, INPUT_H)).astype(np.float32) / 255.0
    img = np.transpose(img, (2, 0, 1))
    img = (img - MEAN) / STD
    inp = np.expand_dims(img, 0).astype(np.float32)

    t0 = time.time()
    out = session.run(None, {"pixel_values": inp})[0][0]
    ms = (time.time() - t0) * 1000

    age = int(max(0, min(100, round(out[0]) + AGE_BIAS)))

    gender_prob = float(out[1])
    if face_key not in state["gender_hist"]:
        state["gender_hist"][face_key] = []
    state["gender_hist"][face_key].append(gender_prob)
    if len(state["gender_hist"][face_key]) > GENDER_HISTORY:
        state["gender_hist"][face_key].pop(0)

    avg_prob = sum(state["gender_hist"][face_key]) / len(state["gender_hist"][face_key])
    gender = "Female" if avg_prob >= 0.5 else "Male"
    gender_conf = avg_prob * 100 if gender == "Female" else (1 - avg_prob) * 100
    age_group = age_to_group(age)

    return gender, round(gender_conf, 1), age, age_group, round(ms, 1)


# ── Inference thread ─────────────────────────────────────────────────────────-
def inference_thread():
    cleanup_counter = 0

    while state["running"]:
        with state["lock"]:
            frame = state["frame"]
        if frame is None:
            time.sleep(0.01)
            continue

        faces = detect_faces(frame)

        if not faces:
            time.sleep(0.01)
            continue

        detections = []
        for i, (x1, y1, x2, y2) in enumerate(faces):
            face_crop = frame[y1:y2, x1:x2]
            if face_crop.size == 0:
                continue
            gender, conf, age, age_group, ms = predict(face_crop, f"face_{i}")
            detections.append(
                {
                    "gender": gender,
                    "gender_confidence": conf,
                    "age_group": age_group,
                    "age_confidence": None,
                }
            )

        if not detections:
            continue

        timestamp_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        image_filename = f"demo_{timestamp_str}_{uuid.uuid4().hex[:6]}.jpg"
        image_path = os.path.join(CAPTURES_DIR, image_filename)

        annotated = frame.copy()
        for index, detection in enumerate(detections):
            text = f"{detection['gender']} {detection['age_group']}"
            cv2.putText(
                annotated,
                text,
                (10, 30 + index * 20),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (0, 200, 80),
                2,
            )

        cv2.imwrite(image_path, annotated)

        event = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "source": "demographics",
            "image_path": image_filename,
            "detections": detections,
        }
        print(json.dumps(event), flush=True)

        # ── Cleanup old captures every 500 iterations ───────────────────────
        cleanup_counter += 1
        if cleanup_counter >= 500:
            cleanup_old_captures()
            cleanup_counter = 0


# ── Camera ───────────────────────────────────────────────────────────────────-
print("Opening camera...", flush=True)
camera_source = _resolve_camera_source()
cap = cv2.VideoCapture(_build_gstreamer_pipeline(camera_source), cv2.CAP_GSTREAMER)

if not cap.isOpened():
    print("GStreamer failed, falling back to V4L2...")
    if isinstance(camera_source, str) and camera_source.isdigit():
        camera_source = int(camera_source)
    cap = cv2.VideoCapture(camera_source)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

if not cap.isOpened():
    print("Could not open the camera")
    exit(1)

print("Camera opened. Press Ctrl+C to exit.\n", flush=True)

t = threading.Thread(target=inference_thread, daemon=True)
t.start()

try:
    while True:
        ret, frame = cap.read()
        if not ret:
            print("Error reading frame")
            break
        with state["lock"]:
            state["frame"] = frame.copy()
except KeyboardInterrupt:
    print("\nStopping...", flush=True)

state["running"] = False
cap.release()
print("Stopped", flush=True)
