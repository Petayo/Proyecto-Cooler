const normalizeTimestamp = (value) => {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return new Date();
  }

  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return new Date();
  }

  return date;
};

const normalizeConfidence = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.max(0, Math.min(100, parsed));
};

const normalizeLabel = (value) => {
  if (typeof value !== 'string' || !value.trim()) {
    return 'Unknown';
  }

  return value.trim();
};

export const normalizeCanPayload = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const events = Array.isArray(payload.events)
    ? payload.events
    : payload.detections
      ? [payload]
      : [];

  const normalized = [];

  events.forEach((event) => {
    if (!event || typeof event !== 'object') {
      return;
    }

    const detections = Array.isArray(event.detections) ? event.detections : [];
    const eventTime = normalizeTimestamp(event.timestamp);
    const imageUrl = typeof event.image_url === 'string' ? event.image_url : null;

    detections.forEach((detection, index) => {
      if (!detection || typeof detection !== 'object') {
        return;
      }

      normalized.push({
        id: `${eventTime.toISOString()}-${index}-${Math.random().toString(36).slice(2, 9)}`,
        timestamp: eventTime,
        label: normalizeLabel(detection.label),
        confidence: normalizeConfidence(detection.confidence),
        imageUrl,
      });
    });
  });

  return normalized;
};
