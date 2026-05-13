from pydantic import BaseModel
from typing import List, Optional, Dict

# ── Demographics ───────────────────────────────────────────────────────────────
class Detection(BaseModel):
    gender:             str
    gender_confidence:  float
    age_group:          str

class DemographicsEvent(BaseModel):
    timestamp:   str
    source:      str = "demographics"
    image_path:  Optional[str] = None
    detections:  List[Detection]

# ── Can Detector ───────────────────────────────────────────────────────────────
class CanEvent(BaseModel):
    timestamp:    str
    source:       str = "can_detector"
    image_path:   Optional[str] = None
    inventory:    Dict[str, int]   # {"Coke": 2, "Apple Soda": 1, ...}
    changes:      Dict[str, int]   # {"Coke": -1}
    event_type:   str              # "item_removed" | "item_added" | "no_change"
    total_objects: int

# ── Status ─────────────────────────────────────────────────────────────────────
class StatusResponse(BaseModel):
    status:               str
    demographics_running: bool
    can_detector_running: bool
    total_events:         int
