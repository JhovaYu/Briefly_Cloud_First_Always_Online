from app.domain.task import Task
from app.ports.task_repository import TaskRepository


class InMemoryTaskRepository(TaskRepository):
    def __init__(self) -> None:
        self._tasks: dict[str, Task] = {}

    async def save(self, task: Task) -> Task:
        self._tasks[task.id] = task
        return task

    async def find_by_id(self, task_id: str) -> Task | None:
        return self._tasks.get(task_id)

    async def find_by_workspace(self, workspace_id: str) -> list[Task]:
        return [t for t in self._tasks.values() if t.workspace_id == workspace_id]

    async def delete(self, task_id: str) -> bool:
        return bool(self._tasks.pop(task_id, None))