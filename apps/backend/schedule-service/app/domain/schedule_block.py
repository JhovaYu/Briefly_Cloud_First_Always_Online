from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass
class ScheduleBlock:
    id: str
    workspace_id: str
    title: str
    day_of_week: int  # 0=Monday, 6=Sunday
    start_time: str   # "HH:MM"
    duration_minutes: int
    color: Optional[str]
    location: Optional[str]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime
    created_by: str