# Can Detector v1

Edge Impulse can detection for the Rubik Pi board. This script is meant to run on-device with the local camera attached to the board, not on this workspace.

## What it does

- Loads the Edge Impulse `.eim` model from `backend/can_detector_v1/models/soda_detector.eim`
- Opens the can camera and runs live inference
- Prints predictions directly in the terminal

## Requirements

- Rubik Pi / compatible Linux edge board
- Python 3
- `opencv-python` or a system OpenCV build with V4L2 support
- `edge_impulse_linux`

Install the Python package on the board:

```bash
pip install edge_impulse_linux
```

## Run

From `backend/can_detector_v1` on the board:

```bash
python3 scripts/can_inference.py
```

The script defaults to `/dev/video2`.

## Camera selection

Override the camera if your board exposes it on another device node:

```bash
python3 scripts/can_inference.py /dev/video2
```

```bash
CAN_CAMERA_SOURCE=/dev/video2 python3 scripts/can_inference.py
```

```bash
CAN_CAMERA_INDEX=2 python3 scripts/can_inference.py
```

Use `v4l2-ctl --list-devices` to confirm which `/dev/video*` node belongs to the can camera.

## Sync to the board

From the repo root, run `./sync.sh` to rsync the contents of `backend/` into `~/smart-cooler` on the Rubik Pi.

If you want to update the destination or host, edit `sync.sh`.
