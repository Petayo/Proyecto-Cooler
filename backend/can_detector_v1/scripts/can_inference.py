import os
import sys
import json
from datetime import datetime, timezone
import uuid
from edge_impulse_linux.image import ImageImpulseRunner
import cv2

# This line looks for the model in the models folder
model_path = os.path.join(os.path.dirname(__file__), "../models/soda_detector.eim")
CAPTURES_DIR = os.environ.get("CAPTURES_DIR", "/home/ubuntu/smart-cooler/captures")
os.makedirs(CAPTURES_DIR, exist_ok=True)


def open_camera(source):
    if isinstance(source, int):
        return cv2.VideoCapture(source, cv2.CAP_V4L2)

    if isinstance(source, str) and source.isdigit():
        return cv2.VideoCapture(int(source), cv2.CAP_V4L2)

    return cv2.VideoCapture(str(source), cv2.CAP_V4L2)


def main():
    if not os.path.exists(model_path):
        print(f"Could not find the model at: {model_path}")
        return

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
    if len(sys.argv) > 1:
        camera_source = sys.argv[1]

    with ImageImpulseRunner(model_path) as runner:
        model_info = runner.init()
        print("Can model loaded correctly", flush=True)
        if dump_result:
            print(f"Model info: {model_info}", flush=True)

        cap = open_camera(camera_source)
        if not cap.isOpened():
            print(
                f"Could not open camera {camera_source}. Try with CAN_CAMERA_SOURCE=/dev/video2 or the correct index."
            )
            return

        print("Streaming can predictions...", flush=True)

        frame_count = 0

        while True:
            success, img = cap.read()
            if not success:
                print("Could not read frames from the camera.", flush=True)
                break

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
