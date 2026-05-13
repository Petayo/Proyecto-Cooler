import os
import sys
import json
import argparse
from datetime import datetime, timezone
import uuid
from edge_impulse_linux.image import ImageImpulseRunner
import cv2

# This line looks for the model in the models folder
model_path = os.path.join(os.path.dirname(__file__), "../models/soda_detector.eim")
CAPTURES_DIR = os.environ.get("CAPTURES_DIR", "/home/ubuntu/smart-cooler/captures")
os.makedirs(CAPTURES_DIR, exist_ok=True)


def _build_gstreamer_pipeline_mjpeg(source, width, height, fps):
    return (
        f"v4l2src device={source} ! "
        f"image/jpeg,width={width},height={height},framerate={fps}/1 ! "
        "jpegdec ! videoconvert ! "
        "video/x-raw,format=BGR ! "
        "appsink drop=true max-buffers=1 sync=false"
    )


def _build_gstreamer_pipeline_raw(source):
    return (
        f"v4l2src device={source} ! "
        "videoconvert ! "
        "video/x-raw,format=BGR ! "
        "appsink drop=true max-buffers=1 sync=false"
    )


def _validate_capture(cap):
    if not cap.isOpened():
        return False
    ok, _ = cap.read()
    if not ok:
        cap.release()
        return False
    return True


def _open_v4l2(source, width, height, fps):
    cap = cv2.VideoCapture(source, cv2.CAP_V4L2)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
    cap.set(cv2.CAP_PROP_FPS, fps)
    return cap


def _open_v4l2_mjpeg(source, width, height, fps):
    cap = cv2.VideoCapture(source, cv2.CAP_V4L2)
    cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*"MJPG"))
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
    cap.set(cv2.CAP_PROP_FPS, fps)
    return cap


def open_camera(source, width, height, fps):
    if isinstance(source, int):
        cap = _open_v4l2_mjpeg(source, width, height, fps)
        if _validate_capture(cap):
            return cap
        return _open_v4l2(source, width, height, fps)

    if isinstance(source, str) and source.isdigit():
        cap = _open_v4l2_mjpeg(int(source), width, height, fps)
        if _validate_capture(cap):
            return cap
        return _open_v4l2(int(source), width, height, fps)

    source = str(source)

    candidates = [
        (width, height, fps),
        (640, 480, 30),
        (320, 240, 30),
    ]

    for w, h, f in candidates:
        cap = _open_v4l2_mjpeg(source, w, h, f)
        if _validate_capture(cap):
            return cap

        pipeline = _build_gstreamer_pipeline_mjpeg(source, w, h, f)
        cap = cv2.VideoCapture(pipeline, cv2.CAP_GSTREAMER)
        if _validate_capture(cap):
            return cap

        pipeline = _build_gstreamer_pipeline_raw(source)
        cap = cv2.VideoCapture(pipeline, cv2.CAP_GSTREAMER)
        if _validate_capture(cap):
            return cap

        cap = _open_v4l2(source, w, h, f)
        if _validate_capture(cap):
            return cap

    return _open_v4l2_mjpeg(source, width, height, fps)


def _parse_args():
    parser = argparse.ArgumentParser(description="Run can detection inference.")
    parser.add_argument(
        "source",
        nargs="?",
        help="Camera source (e.g. /dev/video2 or index).",
    )
    parser.add_argument("--width", type=int, help="Frame width override.")
    parser.add_argument("--height", type=int, help="Frame height override.")
    parser.add_argument("--fps", type=int, help="Frame FPS override.")
    return parser.parse_args()


def main():
    if not os.path.exists(model_path):
        print(
            f"Could not find the model at: {model_path}",
            file=sys.stderr,
            flush=True,
        )
        sys.exit(1)

    args = _parse_args()

    min_conf = float(os.environ.get("CAN_MIN_CONF", "0.5"))
    log_every = int(os.environ.get("CAN_LOG_EVERY", "30"))
    dump_result = os.environ.get("CAN_DUMP_RESULT", "0").lower() in {
        "1",
        "true",
        "yes",
    }
    output_json = os.environ.get("CAN_OUTPUT_JSON", "0").lower() in {
        "1",
        "true",
        "yes",
    }

    camera_source = os.environ.get(
        "CAN_CAMERA_SOURCE", os.environ.get("CAN_CAMERA_INDEX", "/dev/video2")
    )
    frame_width = int(os.environ.get("CAN_FRAME_WIDTH", "1280"))
    frame_height = int(os.environ.get("CAN_FRAME_HEIGHT", "720"))
    frame_fps = int(os.environ.get("CAN_FRAME_FPS", "30"))

    if args.source:
        camera_source = args.source
    if args.width:
        frame_width = args.width
    if args.height:
        frame_height = args.height
    if args.fps:
        frame_fps = args.fps

    with ImageImpulseRunner(model_path) as runner:
        model_info = runner.init()
        print("Can model loaded correctly", flush=True)
        if dump_result:
            print(f"Model info: {model_info}", flush=True)

        print("Opening camera...", flush=True)
        print(f"Camera source: {camera_source}", flush=True)

        cap = open_camera(camera_source, frame_width, frame_height, frame_fps)
        if not cap.isOpened():
            print(
                f"Could not open camera {camera_source}. Try CAN_CAMERA_SOURCE=/dev/video2 or adjust CAN_FRAME_WIDTH/HEIGHT/FPS.",
                file=sys.stderr,
                flush=True,
            )
            sys.exit(2)

        print("Streaming can predictions...", flush=True)

        frame_count = 0

        while True:
            success, img = cap.read()
            if not success:
                print(
                    "Could not read frames from the camera.",
                    file=sys.stderr,
                    flush=True,
                )
                sys.exit(3)

            frame_count += 1
            features, _ = runner.get_features_from_image(img)
            res = runner.classify(features)

            if dump_result and frame_count % log_every == 0:
                print(f"Raw result: {res}", flush=True)

            result = res.get("result", {})
            predictions = []
            detections = []

            if "bounding_boxes" in result:
                for bb in result["bounding_boxes"]:
                    if bb["value"] >= min_conf:
                        confidence = round(bb["value"] * 100, 1)
                        predictions.append(f"{bb['label']} ({confidence:.1f}%)")
                        detections.append(
                            {
                                "label": bb["label"],
                                "confidence": confidence,
                                "box": {
                                    "x": int(bb["x"]),
                                    "y": int(bb["y"]),
                                    "width": int(bb["width"]),
                                    "height": int(bb["height"]),
                                },
                            }
                        )

            elif "classification" in result:
                for label, value in sorted(
                    result["classification"].items(),
                    key=lambda item: item[1],
                    reverse=True,
                ):
                    if value >= min_conf:
                        confidence = round(value * 100, 1)
                        predictions.append(f"{label} ({confidence:.1f}%)")
                        detections.append(
                            {
                                "label": label,
                                "confidence": confidence,
                                "box": None,
                            }
                        )

            if detections:
                timestamp = datetime.now(timezone.utc)
                timestamp_str = timestamp.strftime("%Y%m%d_%H%M%S")
                image_filename = f"can_{timestamp_str}_{uuid.uuid4().hex[:6]}.jpg"
                image_path = os.path.join(CAPTURES_DIR, image_filename)

                annotated = img.copy()
                for index, detection in enumerate(detections):
                    label = detection["label"]
                    conf = detection["confidence"]
                    box = detection.get("box")
                    text = f"{label} {conf:.1f}%"

                    if box:
                        x1 = box["x"]
                        y1 = box["y"]
                        x2 = x1 + box["width"]
                        y2 = y1 + box["height"]
                        cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 180, 255), 2)
                        cv2.putText(
                            annotated,
                            text,
                            (x1, max(0, y1 - 8)),
                            cv2.FONT_HERSHEY_SIMPLEX,
                            0.5,
                            (0, 180, 255),
                            2,
                        )
                    else:
                        cv2.putText(
                            annotated,
                            text,
                            (10, 30 + index * 20),
                            cv2.FONT_HERSHEY_SIMPLEX,
                            0.6,
                            (0, 180, 255),
                            2,
                        )

                cv2.imwrite(image_path, annotated)

                event = {
                    "timestamp": timestamp.isoformat(),
                    "source": "can_detector",
                    "image_path": image_filename,
                    "detections": detections,
                }

                if output_json:
                    print(json.dumps(event), flush=True)
                else:
                    print("Predictions: " + ", ".join(predictions), flush=True)
            elif frame_count % log_every == 0:
                if not output_json:
                    print("No detections above threshold.", flush=True)


if __name__ == "__main__":
    main()
