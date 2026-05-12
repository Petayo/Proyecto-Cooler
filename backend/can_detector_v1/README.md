# Can Detector v1 — Smart Fridge Object Detection

Real-time object detection module for identifying soda cans and dairy products on the Rubik Pi 3.

This module uses a custom-trained model from Edge Impulse to detect and locate specific beverages inside a smart fridge environment. It is optimized to run on Qualcomm hardware using the QNN (Qualcomm Neural Network) accelerator.

---

## Hardware / Environment

* **Device:** Rubik Pi 3 / Qualcomm QCS6490
* **OS:** Ubuntu 24.04
* **Camera:** USB webcam (typically `/dev/video0`)
* **Framework:** Edge Impulse Linux (AARCH64)
* **Acceleration:** Qualcomm QNN (Int8 Quantized)

---

## On-Device Performance (Estimated)

* **Inferencing time:** 32094 ms (Standard) / <50 ms (Optimized with QNN)
* **Peak RAM usage:** 914.3K
* **Flash usage:** 705.3K

---

## Classes (Labels)

The model is trained to recognize the following 8 categories:
1. **Apple Soda** (Sidral Mundet/Manzana)
2. **Carbonated Water**
3. **Coke**
4. **Jelly**
5. **Mundet**
6. **Soda**
7. **Yogurt**
8. **YogurtD** (Drinking Yogurt)

---

## Project Structure