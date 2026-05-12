from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class Detection(BaseModel):
    gender:             str
    gender_confidence:  float
    age_group:          str

class DemographicsEvent(BaseModel):
    timestamp:   str
    source:      str = "demographics"
    detections:  List[Detection]

class CanEvent(BaseModel):
    timestamp:   str
    source:      str = "can_detector"
    product:     str
    action:      str
    confidence:  float

class StatusResponse(BaseModel):
    status:              str
    demographics_running: bool
    can_detector_running: bool
    total_events:        int