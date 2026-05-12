# Smart Cooler

An edge AI system for smart coolers deployed in small shops. The system uses computer vision to track product inventory and demographic insights.

## Project Structure

```
.
├── frontend/          # React dashboard application
│   ├── src/           # React source code
│   ├── public/        # Static assets
│   ├── package.json   # Frontend dependencies
│   └── README.md      # Frontend documentation
├── backend/           # Backend services and CV models
│   ├── can_detector_v1/        # Can/bottle detection model
│   └── demographics_v2/        # Demographics detection model
└── README.md          # This file
```

## Getting Started

### Frontend Setup

```bash
cd frontend
npm install
npm start
```

Frontend dashboard runs on `http://localhost:3000` by default.

### Backend

Backend code and models are designed to run on a Rubik Pi edge board. See [backend/README.md](backend/README.md) for details.

## Development

- Frontend: React-based dashboard for metrics and insights
- Backend: CV models (TensorFlow Lite) for can detection and demographics analysis
- Models are deployed on edge hardware and won't run locally

## Key Features

1. Real-time demographic polling from edge device
2. Inventory tracking through bottle/can detection
3. Daily/weekly aggregated analytics
4. Restocking recommendations

For detailed frontend configuration, see [frontend/README.md](frontend/README.md).
