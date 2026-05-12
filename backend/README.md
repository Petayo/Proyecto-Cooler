# Proyecto-Cooler

# Demographics v2 — Smart Fridge Vision API

Real-time age and gender detection module for Rubik Pi 3.

This project runs a camera-based demographics pipeline and exposes the results through a FastAPI backend. The current version detects faces, predicts gender and age group, and stores recent events in memory so they can be consumed by a frontend or another service.

The system is designed as part of a Smart Fridge Vision project running on Rubik Pi 3.

---

## Hardware / Environment

- **Device:** Rubik Pi 3 / Qualcomm QCS6490
- **OS:** Ubuntu 24.04
- **Camera:** USB webcam
- **Camera port:** `/dev/video0`
- **Python:** 3.12 recommended
- **Backend:** FastAPI + Uvicorn
- **Computer Vision:** OpenCV DNN + ONNX Runtime

---

## Current Pipeline

```text
USB Camera (/dev/video2)
        ↓
GStreamer / OpenCV frame capture
        ↓
OpenCV DNN Face Detector
        ↓
Age/Gender ONNX Model
        ↓
JSON event output
        ↓
FastAPI backend collector
        ↓
API endpoints
````

---

## Project Structure

```text
demographics_v2/
├── backend/
│   ├── main.py
│   ├── collector.py
│   └── models.py
├── scripts/
│   └── demographics_json.py
├── models_cpu/
│   └── face_detector/
│       ├── deploy.prototxt
│       └── res10_300x300_ssd_iter_140000.caffemodel
├── requirements.txt
└── README.md
```

---

## Important: Download the Age/Gender ONNX Model

The age/gender model is **not included in this repository** because it is too large.

Create the model folder:

```bash
mkdir -p demographics_v2/models_cpu/age_gender
```

Download the ONNX model:

```bash
curl -L -o demographics_v2/models_cpu/age_gender/age_gender_modern.onnx \
"https://huggingface.co/onnx-community/age-gender-prediction-ONNX/resolve/main/onnx/model.onnx"
```

Expected final path:

```text
demographics_v2/models_cpu/age_gender/age_gender_modern.onnx
```

The current script expects the model at:

```text
/home/ubuntu/rubikpi/demographics_v2/models_cpu/age_gender/age_gender_modern.onnx
```

If your project is located somewhere else, update `MODEL_PATH` inside:

```text
demographics_v2/scripts/demographics_json.py
```

---

## System Dependencies

Install the required system packages:

```bash
sudo apt update && sudo apt install -y \
    python3 python3-pip \
    python3-gi python3-gi-cairo \
    gir1.2-gstreamer-1.0 \
    gir1.2-gst-plugins-base-1.0 \
    gstreamer1.0-tools \
    v4l-utils \
    libgl1 libglib2.0-0
```

If available on the Rubik Pi image, also install Qualcomm GStreamer plugins:

```bash
sudo apt install -y gstreamer1.0-plugins-qcom
```

---

## Python Setup

From the project folder:

```bash
cd ~/rubikpi/demographics_v2
pip3 install --break-system-packages -r requirements.txt
```

Recommended `requirements.txt`:

```txt
fastapi
uvicorn[standard]
pydantic
numpy
onnxruntime
```

> Note: OpenCV is required, but on Rubik Pi it is better to use the system/OpenCV build that supports GStreamer instead of installing `opencv-python` through pip. The pip version may not include GStreamer support.

---

## Camera Configuration

The current camera pipeline expects:

```text
Device: /dev/video2
Format: MJPG
Resolution: 1280x720
FPS: 30
```

Verify connected cameras:

```bash
v4l2-ctl --list-devices
```

Verify supported formats:

```bash
v4l2-ctl --device=/dev/video2 --list-formats-ext
```

If the camera appears on another port, edit the `CAMERA_PIPELINE` inside:

```text
demographics_v2/scripts/demographics_json.py
```

Example line to modify:

```python
"v4l2src device=/dev/video2 ! "
```

---

## Run the Backend

From the backend folder:

```bash
cd ~/rubikpi/demographics_v2/backend
python3 main.py
```

The backend starts the demographics collector automatically.

Default API URL:

```text
http://192.168.1.153:8000
```

API documentation:

```text
http://192.168.1.153:8000/docs
```

---

## API Endpoints

### Root

```http
GET /
```

Returns a basic API message.

Example response:

```json
{
  "message": "Smart Fridge Vision API",
  "docs": "/docs"
}
```

---

### Status

```http
GET /status
```

Example response:

```json
{
  "status": "running",
  "demographics_running": true,
  "can_detector_running": false,
  "total_events": 10,
  "rubikpi_ip": "192.168.1.153",
  "port": 8000
}
```

---

### All Events

```http
GET /events?limit=50
```

Returns the latest events from all available sources.

---

### Demographics Events

```http
GET /events/demographics?limit=50
```

Returns only age/gender detection events.

Example response:

```json
{
  "events": [
    {
      "timestamp": "2026-05-11T00:00:00+00:00",
      "source": "demographics",
      "detections": [
        {
          "gender": "Male",
          "gender_confidence": 94.2,
          "age_group": "18-24"
        }
      ]
    }
  ],
  "count": 1
}
```

---

### Can Detector Events

```http
GET /events/can?limit=50
```

Placeholder endpoint for future can detector integration.

---

### Post Can Detector Event

```http
POST /events/can
```

Placeholder endpoint for the can detector model.

Example body:

```json
{
  "product": "Coca-Cola",
  "action": "detected",
  "confidence": 0.94
}
```

---

## Event Format

Demographics events follow this structure:

```json
{
  "timestamp": "2026-05-11T00:00:00+00:00",
  "source": "demographics",
  "detections": [
    {
      "gender": "Female",
      "gender_confidence": 89.5,
      "age_group": "18-24"
    }
  ]
}
```

---

## How It Works

The backend starts `demographics_json.py` as a subprocess.

The script reads frames from the USB camera, detects faces using the Caffe face detector, predicts age and gender using an ONNX model, and prints JSON events to stdout.

The collector reads those JSON lines, stores the latest events in an in-memory circular buffer, and exposes them through the FastAPI endpoints.

---

## Technical Notes

* Face detection uses OpenCV DNN with a Caffe ResNet SSD model.
* Age/gender prediction uses an ONNX model through ONNX Runtime.
* The age/gender ONNX model is not included in Git and must be downloaded during setup.
* The backend stores the latest 1000 events in memory.
* The can detector endpoints already exist, but the can model is still pending integration.
* OpenCV is required even without visual display because it is used for camera capture, frame processing, and face detection.
* GStreamer is required for the current camera capture pipeline.
* Wayland/display variables are not essential for the API-only flow unless visual output is added later.

---

## Git Ignore Recommendation

The repository should ignore large model files and Python cache files:

```gitignore
*.onnx
*.pt
*.pth
*.engine
__pycache__/
*.pyc
.env
.venv/
venv/
.DS_Store
```

---

## Run Checklist

1. Clone the repository.
2. Install system dependencies.
3. Install Python dependencies.
4. Download `age_gender_modern.onnx`.
5. Verify camera is available at `/dev/video2`.
6. Run the backend with `python3 main.py`.
7. Open `/docs` or call `/status`.

---

## Current Status

Implemented:

* Demographics backend
* Camera-based age/gender JSON pipeline
* FastAPI endpoints
* In-memory event collector
* Placeholder can detector endpoints

```
```
