import os
import sys
from edge_impulse_linux.image import ImageImpulseRunner
import cv2

# This line looks for the model in the models folder
model_path = os.path.join(os.path.dirname(__file__), "../models/soda_detector.eim")


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

    camera_source = os.environ.get(
        "CAN_CAMERA_SOURCE", os.environ.get("CAN_CAMERA_INDEX", "/dev/video2")
    )
    if len(sys.argv) > 1:
        camera_source = sys.argv[1]

    with ImageImpulseRunner(model_path) as runner:
        model_info = runner.init()
        print("Can model loaded correctly", flush=True)

        cap = open_camera(camera_source)
        if not cap.isOpened():
            print(
                f"Could not open camera {camera_source}. Try with CAN_CAMERA_SOURCE=/dev/video2 or the correct index."
            )
            return

        print("Streaming can predictions...", flush=True)

        while True:
            success, img = cap.read()
            if not success:
                print("Could not read frames from the camera.", flush=True)
                break

            features, _ = runner.get_features_from_image(img)
            res = runner.classify(features)

            if "bounding_boxes" in res["result"]:
                predictions = []
                for bb in res["result"]["bounding_boxes"]:
                    predictions.append(f"{bb['label']} ({bb['value']*100:.1f}%)")

                if predictions:
                    print("Predictions: " + ", ".join(predictions), flush=True)


if __name__ == "__main__":
    main()
