# Smart Cooler Frontend

Operational dashboard for a smart cooler deployed in small shops.

## What this app does

1. Polls demographics predictions from the outside camera model in near real time.
2. Aggregates events into day and week metrics to support restocking decisions.
3. Provides a bottle-model placeholder through a simulator while the inside-camera model is still in progress.

## Expected demographics payload

The edge board should return JSON in this shape from the configured endpoint:

```json
{
	"timestamp": "2026-05-11T15:42:01.000Z",
	"detections": [
		{
			"gender": "Male",
			"gender_confidence": 97.6,
			"age_group": "18-24",
			"age_confidence": 91.0
		}
	]
}
```

Notes:

1. `age_confidence` is expected as a dedicated field.
2. Unknown or invalid fields are normalized safely in the frontend.

## Configuration

All runtime config is centralized in [src/config/appConfig.js](./src/config/appConfig.js).

Defaults:

1. Edge URL: `http://192.168.1.131:8000`
2. Endpoint path: `/demographics`
3. Poll interval: `1500` ms

You can override via environment variables:

1. `REACT_APP_EDGE_BASE_URL`
2. `REACT_APP_DEMOGRAPHICS_PATH`
3. `REACT_APP_POLLING_INTERVAL_MS`
4. `REACT_APP_STALE_AFTER_MS`
5. `REACT_APP_MAX_DEMOGRAPHIC_EVENTS`
6. `REACT_APP_MAX_BOTTLE_EVENTS`

## Run locally

1. `npm install`
2. `npm start`

App runs at `http://localhost:3000`.

## Testing and build

1. `npm test`
2. `npm run build`

## MVP scope boundaries

1. Outside camera: real polling integration implemented.
2. Inside camera bottle model: simulated event stream only.
3. Persistence/export backend: not included yet.

## Network and CORS

The edge endpoint must allow browser access from the frontend origin, including appropriate CORS headers.
