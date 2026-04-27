from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from app.domain.task_state import TaskState, Priority


@dataclass
class Task:
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