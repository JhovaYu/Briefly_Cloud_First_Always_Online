from dataclasses import dataclass
from datetime import datetime


@dataclass
class Workspace:
    id: str
    name: str
    owner_id: str
    created_at: datetime
    updated_at: datetime
