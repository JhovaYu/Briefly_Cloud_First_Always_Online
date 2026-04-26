from dataclasses import dataclass
from datetime import datetime


@dataclass
class DocumentMetadata:
    id: str
    workspace_id: str
    title: str
    created_by: str
    created_at: datetime
    updated_at: datetime
