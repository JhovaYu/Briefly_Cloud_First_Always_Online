from abc import ABC, abstractmethod
from app.domain.task import Task


class TaskRepository(ABC):
    @abstractmethod
    async def save(self, task: Task) -> Task: ...

    @abstractmethod
    async def find_by_id(self, task_id: str) -> Task | None: ...

    @abstractmethod
    async def find_by_workspace(self, workspace_id: str) -> list[Task]: ...

    @abstractmethod
    async def delete(self, task_id: str) -> bool: ...