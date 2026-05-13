# Smart Cooler Frontend

Operational dashboard for a smart cooler deployed in small shops.

## What this app does

1. Polls demographics predictions from the outside camera model in near real time.
2. Polls can detections from the inside camera model.
3. Aggregates events into day and week metrics to support restocking decisions.

## Expected demographics payload

The edge board should return JSON in this shape from the configured endpoint:

```json
{
	"events": [
		{
			"timestamp": "2026-05-11T15:42:01.000Z",
			"image_path": "demo_20260511_154201_ab12cd.jpg",
			"image_url": "http://192.168.1.153:8000/captures/demo_20260511_154201_ab12cd.jpg",
			"detections": [
				{
					"gender": "Male",
					"gender_confidence": 97.6,
					"age_group": "18-24",
					"age_confidence": null
				}
			]
		}
	]
}
```

Notes:

1. `image_url` is used to render recent captures.
2. `age_confidence` can be null and is normalized safely in the frontend.

## Expected can payload

```json
{
	"events": [
		{
			"timestamp": "2026-05-11T15:42:01.000Z",
			"image_path": "can_20260511_154201_ab12cd.jpg",
			"image_url": "http://192.168.1.153:8000/captures/can_20260511_154201_ab12cd.jpg",
			"detections": [
				{
					"label": "Coke",
					"confidence": 94.2,
					"box": { "x": 120, "y": 64, "width": 220, "height": 310 }
				}
			]
		}
	]
}
```

## Configuration

All runtime config is centralized in [src/config/appConfig.js](./src/config/appConfig.js).

Defaults:

1. Edge URL: `http://192.168.1.153:8000`
2. Demographics endpoint: `/events/demographics`
3. Can endpoint: `/events/can`
4. Poll interval: `1500` ms

You can override via environment variables:

1. `REACT_APP_EDGE_BASE_URL`
2. `REACT_APP_DEMOGRAPHICS_EVENTS_PATH`
3. `REACT_APP_CAN_EVENTS_PATH`
4. `REACT_APP_POLLING_INTERVAL_MS`
5. `REACT_APP_STALE_AFTER_MS`
6. `REACT_APP_MAX_DEMOGRAPHIC_EVENTS`
7. `REACT_APP_MAX_CAN_EVENTS`

## Run locally

1. `npm install`
2. `npm start`

App runs at `http://localhost:3000`.

## Testing and build

1. `npm test`
2. `npm run build`

## MVP scope boundaries

1. Outside camera: real polling integration implemented.
2. Inside camera: real polling integration implemented.
3. Persistence/export backend: not included yet.

## Network and CORS

The edge endpoint must allow browser access from the frontend origin, including appropriate CORS headers.

Captured images are served from `/captures/{filename}` by the backend. If images do
not appear, confirm the backend is running and the Rubik Pi has a writable
`~/smart-cooler/captures` directory.
