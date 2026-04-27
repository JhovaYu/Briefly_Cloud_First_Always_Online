from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass
class TaskList:
    id: str
    workspace_id: str
    name: str
    color: Optional[str]
    created_at: datetime
    updated_at: datetime
    created_by: str