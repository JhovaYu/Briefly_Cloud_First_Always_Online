from enum import Enum


class TaskState(str, Enum):
    PENDING = "pending"
    WORKING = "working"
    DONE = "done"


class Priority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"