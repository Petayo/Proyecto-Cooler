# Smart Cooler Backend

Edge backend for Rubik Pi 3. Each model runs in its own folder, and the unified
API service exposes events for both demographics and can detection.

The system captures frames, runs inference per model, stores recent events in
memory, and serves captured images for the frontend.

---

## Hardware / Environment

- **Device:** Rubik Pi 3 / Qualcomm QCS6490
- **OS:** Ubuntu 24.04
- **Camera:** USB webcam
- **Python:** 3.12 recommended
- **Backend:** FastAPI + Uvicorn
- **Computer Vision:** OpenCV DNN + ONNX Runtime
- **Inference:** Edge Impulse runtime for can detection

---

## Current Pipeline

```text
Outside Camera (set by DEMO_CAMERA_SOURCE)
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
backend/
├── api/
│   ├── collector.py
│   └── main.py
├── can_detector_v1/
│   ├── models/
│   └── scripts/
│       └── can_inference.py
└── demographics_v2/
    ├── models_cpu/
    └── scripts/
        └── demographics_json.py
```

---

## Download the Age/Gender ONNX Model

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
/home/ubuntu/smart-cooler/demographics_v2/models_cpu/age_gender/age_gender_modern.onnx
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
cd ~/smart-cooler
pip3 install --break-system-packages -r demographics_v2/requirements.txt
pip3 install edge_impulse_linux
```

> Note: OpenCV is required, but on Rubik Pi it is better to use the system/OpenCV build that supports GStreamer instead of installing `opencv-python` through pip. The pip version may not include GStreamer support.

---

## Camera Configuration

Each model must use a different camera device. Configure both cameras using env
vars before starting the API service.

Find the active camera device with:

```bash
v4l2-ctl --list-devices
```

The demographics pipeline currently expects:

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

Environment variables:

```text
DEMO_CAMERA_SOURCE=/dev/video2
CAN_CAMERA_SOURCE=/dev/video4
```

You can also use indexes, for example `DEMO_CAMERA_INDEX=0`.

Find active camera devices with:

```bash
v4l2-ctl --list-devices
```

Verify supported formats:

```bash
v4l2-ctl --device=/dev/video2 --list-formats-ext
```

If needed, edit the GStreamer pipeline in:

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
cd ~/smart-cooler/api
export DEMO_CAMERA_SOURCE=/dev/video0
export CAN_CAMERA_SOURCE=/dev/video2
python3 main.py
```

The API exposes:

1. `/events/demographics` for outside-camera detections.
2. `/events/can` for inside-camera detections.
3. `/captures/{filename}` to serve captured images.
4. `/captures` to list recent captures.

The backend starts both collectors automatically.

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
  "message": "Smart Cooler API",
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
      "image_path": "demo_20260511_000000_ab12cd.jpg",
      "image_url": "http://192.168.1.153:8000/captures/demo_20260511_000000_ab12cd.jpg",
      "detections": [
        {
          "gender": "Male",
          "gender_confidence": 94.2,
          "age_group": "18-24",
          "age_confidence": null
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

Returns can detector events.

Example response:

```json
{
  "events": [
    {
      "timestamp": "2026-05-11T00:00:00+00:00",
      "source": "can_detector",
      "image_path": "can_20260511_000000_ab12cd.jpg",
      "image_url": "http://192.168.1.153:8000/captures/can_20260511_000000_ab12cd.jpg",
      "detections": [
        {
          "label": "Coke",
          "confidence": 94.2,
          "box": { "x": 120, "y": 64, "width": 220, "height": 310 }
        }
      ]
    }
  ],
  "count": 1
}
```

---

## Event Format

Both models emit:

```json
{
  "timestamp": "2026-05-11T00:00:00+00:00",
  "source": "demographics | can_detector",
  "image_path": "demo_...jpg | can_...jpg",
  "image_url": "http://192.168.1.153:8000/captures/<filename>",
  "detections": []
}
```

---

## How It Works

The API starts both model scripts as subprocesses:

1. `demographics_json.py` captures frames, detects faces, predicts age/gender, writes annotated images, and prints JSON events.
2. `can_inference.py` runs the Edge Impulse model, writes annotated images, and prints JSON events.

The collector reads those JSON lines, stores the latest events in an in-memory
circular buffer, and exposes them through the FastAPI endpoints. Subprocess
stderr is forwarded to the API logs for troubleshooting.

---

## Technical Notes

* Face detection uses OpenCV DNN with a Caffe ResNet SSD model.
* Age/gender prediction uses an ONNX model through ONNX Runtime.
* The age/gender ONNX model is not included in Git and must be downloaded during setup.
* The backend stores the latest 2000 events in memory.
* OpenCV is required for camera capture and frame processing.
* GStreamer is required for the current camera capture pipeline.

---

## Run Checklist

1. Clone the repository on the Rubik Pi.
2. Install system dependencies.
3. Install Python dependencies.
4. Download `age_gender_modern.onnx`.
5. Set `DEMO_CAMERA_SOURCE` and `CAN_CAMERA_SOURCE` to different devices.
6. Run the backend with `python3 main.py`.
7. Open `/docs` or call `/status`.

## Troubleshooting

* If a collector stops immediately, check API logs for stderr output.
* If you see "device is busy", set different camera devices for `DEMO_CAMERA_SOURCE` and `CAN_CAMERA_SOURCE`.
* If demographics stops with missing files, confirm the age/gender ONNX model path is correct.
