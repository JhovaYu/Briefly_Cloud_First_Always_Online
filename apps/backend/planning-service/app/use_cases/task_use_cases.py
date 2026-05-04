from datetime import datetime
from app.domain.task import Task
from app.domain.task_state import TaskState, Priority
from app.ports.task_repository import TaskRepository
from app.domain.errors import TaskNotFound


async def create_task(
    task_id: str,
    workspace_id: str,
    text: str,
    state: TaskState,
    priority: Priority,
    user_id: str,
    task_repo: TaskRepository,
    list_id: str | None = None,
    assignee_id: str | None = None,
    due_date: datetime | None = None,
    description: str | None = None,
    tags: list[str] | None = None,
) -> Task:
    now = datetime.utcnow()
    task = Task(
        id=task_id,
        workspace_id=workspace_id,
        list_id=list_id,
        text=text,
        state=state,
        priority=priority,
        assignee_id=assignee_id,
        due_date=due_date,
        description=description,
        tags=tags,
        created_at=now,
        updated_at=now,
        completed_at=None,
        created_by=user_id,
    )
    return await task_repo.save(task)


async def list_tasks(
    workspace_id: str,
    task_repo: TaskRepository,
    due_date: str | None = None,
) -> list[Task]:
    tasks = await task_repo.find_by_workspace(workspace_id)
    if due_date:
        from datetime import date as date_class
        filter_date = date_class.fromisoformat(due_date)
        tasks = [
            t for t in tasks
            if t.due_date and t.due_date.date() == filter_date
        ]
    return tasks


async def update_task(
    task_id: str,
    workspace_id: str,
    task_repo: TaskRepository,
    list_id: str | None = None,
    text: str | None = None,
    state: TaskState | None = None,
    priority: Priority | None = None,
    assignee_id: str | None = None,
    due_date: datetime | None = None,
    description: str | None = None,
    tags: list[str] | None = None,
) -> Task:
    existing = await task_repo.find_by_id(task_id)
    if existing is None or existing.workspace_id != workspace_id:
        raise TaskNotFound("Task not found")

    updated_fields = {}
    if list_id is not None:
        updated_fields["list_id"] = list_id
    if text is not None:
        updated_fields["text"] = text
    if state is not None:
        updated_fields["state"] = state
        if state == TaskState.DONE and existing.state != TaskState.DONE:
            updated_fields["completed_at"] = datetime.utcnow()
    if priority is not None:
        updated_fields["priority"] = priority
    if assignee_id is not None:
        updated_fields["assignee_id"] = assignee_id
    if due_date is not None:
        updated_fields["due_date"] = due_date
    if description is not None:
        updated_fields["description"] = description
    if tags is not None:
        updated_fields["tags"] = tags

    for key, value in updated_fields.items():
        setattr(existing, key, value)
    existing.updated_at = datetime.utcnow()

    return await task_repo.save(existing, is_update=True)


async def delete_task(
    task_id: str,
    workspace_id: str,
    task_repo: TaskRepository,
) -> bool:
    existing = await task_repo.find_by_id(task_id)
    if existing is None or existing.workspace_id != workspace_id:
        raise TaskNotFound("Task not found")
    return await task_repo.delete(task_id)