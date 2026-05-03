from dataclasses import dataclass
from datetime import datetime


@dataclass
class WorkspaceSharedText:
    workspace_id: str
    content: str
    updated_by: str | None
    updated_at: datetime
    version: int