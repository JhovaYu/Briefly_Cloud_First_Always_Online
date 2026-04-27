from app.domain.task_list import TaskList
from app.ports.task_list_repository import TaskListRepository


class InMemoryTaskListRepository(TaskListRepository):
    def __init__(self) -> None:
        self._lists: dict[str, TaskList] = {}

    async def save(self, task_list: TaskList) -> TaskList:
        self._lists[task_list.id] = task_list
        return task_list

    async def find_by_id(self, list_id: str) -> TaskList | None:
        return self._lists.get(list_id)

    async def find_by_workspace(self, workspace_id: str) -> list[TaskList]:
        return [tl for tl in self._lists.values() if tl.workspace_id == workspace_id]