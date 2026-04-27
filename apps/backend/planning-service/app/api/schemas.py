from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field

from app.domain.task_state import TaskState, Priority


class CreateTaskListRequest(BaseModel):
    id: str = Field(..., min_length=1, max_length=36, description="Client-generated UUID")
    name: str = Field(..., min_length=1, max_length=255)
    color: Optional[str] = Field(None, max_length=20)


class TaskListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    workspace_id: str
    name: str
    color: Optional[str]
    created_at: datetime
    updated_at: datetime
    created_by: str


class TaskListListResponse(BaseModel):
    task_lists: list[TaskListResponse]


class CreateTaskRequest(BaseModel):
    id: str = Field(..., min_length=1, max_length=36, description="Client-generated UUID")
    list_id: Optional[str] = Field(None, max_length=36)
    text: str = Field(..., min_length=1, max_length=10000)
    state: TaskState = Field(default=TaskState.PENDING)
    priority: Priority = Field(default=Priority.MEDIUM)
    assignee_id: Optional[str] = Field(None, max_length=36)
    due_date: Optional[datetime] = None
    description: Optional[str] = Field(None, max_length=5000)
    tags: Optional[list[str]] = Field(None, max_length=20)


class UpdateTaskRequest(BaseModel):
    list_id: Optional[str] = Field(None, max_length=36)
    text: Optional[str] = Field(None, min_length=1, max_length=10000)
    state: Optional[TaskState] = None
    priority: Optional[Priority] = None
    assignee_id: Optional[str] = Field(None, max_length=36)
    due_date: Optional[datetime] = None
    description: Optional[str] = Field(None, max_length=5000)
    tags: Optional[list[str]] = Field(None, max_length=20)


class TaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    workspace_id: str
    list_id: Optional[str]
    text: str
    state: TaskState
    priority: Priority
    assignee_id: Optional[str]
    due_date: Optional[datetime]
    description: Optional[str]
    tags: Optional[list[str]]
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime]
    created_by: str


class TasksListResponse(BaseModel):
    tasks: list[TaskResponse]