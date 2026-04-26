from dataclasses import dataclass
from datetime import datetime
from enum import Enum


class MembershipRole(str, Enum):
    OWNER = "owner"
    MEMBER = "member"
    VIEWER = "viewer"


@dataclass
class Membership:
    id: str
    workspace_id: str
    user_id: str
    role: MembershipRole
    joined_at: datetime
