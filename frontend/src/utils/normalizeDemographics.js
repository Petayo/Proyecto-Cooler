const normalizeConfidence = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.max(0, Math.min(100, parsed));
};

const normalizeGender = (value) => {
  if (typeof value !== 'string') {
    return 'Unknown';
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'male') {
    return 'Male';
  }

  if (normalized === 'female') {
    return 'Female';
  }

  return 'Unknown';
};

const normalizeAgeGroup = (value) => {
  if (typeof value !== 'string' || !value.trim()) {
    return 'Unknown';
  }

  return value.trim();
};

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

export const normalizeDemographicsPayload = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const detections = Array.isArray(payload.detections) ? payload.detections : [];
  const eventTime = normalizeTimestamp(payload.timestamp);

  return detections
    .map((detection, index) => {
      if (!detection || typeof detection !== 'object') {
        return null;
      }

      return {
        id: `${eventTime.toISOString()}-${index}-${Math.random().toString(36).slice(2, 9)}`,
        timestamp: eventTime,
        gender: normalizeGender(detection.gender),
        genderConfidence: normalizeConfidence(detection.gender_confidence),
        ageGroup: normalizeAgeGroup(detection.age_group),
        ageConfidence: normalizeConfidence(detection.age_confidence),
      };
    })
    .filter(Boolean);
};
