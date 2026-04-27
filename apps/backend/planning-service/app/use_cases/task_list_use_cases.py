from datetime import datetime
from app.domain.task_list import TaskList
from app.ports.task_list_repository import TaskListRepository


async def create_task_list(
    list_id: str,
    workspace_id: str,
    name: str,
    user_id: str,
    task_list_repo: TaskListRepository,
    color: str | None = None,
) -> TaskList:
    now = datetime.utcnow()
    task_list = TaskList(
        id=list_id,
        workspace_id=workspace_id,
        name=name,
        color=color,
        created_at=now,
        updated_at=now,
        created_by=user_id,
    )
    return await task_list_repo.save(task_list)


async def list_task_lists(
    workspace_id: str,
    task_list_repo: TaskListRepository,
) -> list[TaskList]:
    return await task_list_repo.find_by_workspace(workspace_id)