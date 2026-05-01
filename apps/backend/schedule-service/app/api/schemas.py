from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class CreateScheduleBlockRequest(BaseModel):
    id: str = Field(..., min_length=1, max_length=36, description="Client-generated UUID")
    title: str = Field(..., min_length=1, max_length=255)
    day_of_week: int = Field(..., ge=0, le=6, description="0=Monday, 6=Sunday")
    start_time: str = Field(..., pattern=r"^\d{2}:\d{2}$", description="HH:MM format")
    duration_minutes: int = Field(..., ge=5, le=480, description="Duration in minutes (5min to 8h)")
    color: Optional[str] = Field(None, max_length=20)
    location: Optional[str] = Field(None, max_length=255)
    notes: Optional[str] = Field(None, max_length=2000)


class UpdateScheduleBlockRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    day_of_week: Optional[int] = Field(None, ge=0, le=6)
    start_time: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$")
    duration_minutes: Optional[int] = Field(None, ge=5, le=480)
    color: Optional[str] = Field(None, max_length=20)
    location: Optional[str] = Field(None, max_length=255)
    notes: Optional[str] = Field(None, max_length=2000)


class ScheduleBlockResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    workspace_id: str
    title: str
    day_of_week: int
    start_time: str
    duration_minutes: int
    color: Optional[str]
    location: Optional[str]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime
    created_by: str


class ScheduleBlockListResponse(BaseModel):
    blocks: list[ScheduleBlockResponse]