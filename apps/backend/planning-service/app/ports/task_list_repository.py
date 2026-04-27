from abc import ABC, abstractmethod
from app.domain.task_list import TaskList


class TaskListRepository(ABC):
    @abstractmethod
    async def save(self, task_list: TaskList) -> TaskList: ...

    @abstractmethod
    async def find_by_id(self, list_id: str) -> TaskList | None: ...

    @abstractmethod
    async def find_by_workspace(self, workspace_id: str) -> list[TaskList]: ...