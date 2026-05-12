Thsi project is a smart cooler: an edge ai board (rubikpi) will be running two models, each with its own camera. an outisde facing camera will run demographic detection, and an inside facing camera will run can detection. The purpose is for vendors to see how often to restock each product, and also get market insights (who buys each product?). You are inside a folder containing two things: first, the react frontend project, in progress. Also, in backend/ is the CV models and backend code. backend and models will be run on the rubikpi board but they are provided here for context.

Dont use emojis in code.
Remember that the models will only be run on the board, they require tflite and wont run here.
Always do testing after a feature and make sure nothing broke.
Maintain a single clear documentation structure, dont add additional per-feature md files, just update the main README.md and the frontend/backend READMEs as needed, and keep them concise and complete. Avoid redundancies.

If you are going to ssh, use sshpass ubuntu@192.168.1.153, password is rubikpi