import os
from edge_impulse_linux.image import ImageImpulseRunner
import cv2

# Esta línea busca el modelo en la carpeta models
model_path = os.path.join(os.path.dirname(__file__), "../models/soda_detector.eim")

def main():
    if not os.path.exists(model_path):
        print(f"No encuentro el modelo en: {model_path}")
        return

    with ImageImpulseRunner(model_path) as runner:
        model_info = runner.init()
        print("¡Modelo de latas cargado con éxito!")
        
        cap = cv2.VideoCapture(0) # Esto usa la cámara de la Rubik Pi
        while True:
            success, img = cap.read()
            if not success:
                break
                
            features, _ = runner.get_features_from_image(img)
            res = runner.classify(features)
            
            if "bounding_boxes" in res["result"]:
                for bb in res["result"]["bounding_boxes"]:
                    print(f"Detectado: {bb['label']} ({bb['value']*100:.1f}%)")

if __name__ == "__main__":
    main()