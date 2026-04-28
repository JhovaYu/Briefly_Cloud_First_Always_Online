import pytest
from datetime import datetime
from unittest.mock import AsyncMock

from app.domain.task import Task
from app.domain.task_list import TaskList
from app.domain.task_state import TaskState, Priority
from app.ports.task_repository import TaskRepository
from app.ports.task_list_repository import TaskListRepository
from app.use_cases import create_task, list_tasks, update_task, delete_task, create_task_list, list_task_lists
from app.domain.errors import TaskNotFound


class MockTaskRepository(TaskRepository):
    def __init__(self):
        self._tasks = {}

    async def save(self, task: Task, is_update: bool = False) -> Task:
        self._tasks[task.id] = task
        return task

    async def find_by_id(self, task_id: str) -> Task | None:
        return self._tasks.get(task_id)

    async def find_by_workspace(self, workspace_id: str) -> list[Task]:
        return [t for t in self._tasks.values() if t.workspace_id == workspace_id]

    async def delete(self, task_id: str) -> bool:
        return bool(self._tasks.pop(task_id, None))


class MockTaskListRepository(TaskListRepository):
    def __init__(self):
        self._lists = {}

    async def save(self, task_list: TaskList) -> TaskList:
        self._lists[task_list.id] = task_list
        return task_list

    async def find_by_id(self, list_id: str) -> TaskList | None:
        return self._lists.get(list_id)

    async def find_by_workspace(self, workspace_id: str) -> list[TaskList]:
        return [tl for tl in self._lists.values() if tl.workspace_id == workspace_id]


class TestCreateTask:
    @pytest.mark.asyncio
    async def test_creates_task_with_client_generated_id(self):
        repo = MockTaskRepository()
        task = await create_task(
            task_id="client-uuid-123",
            workspace_id="ws-123",
            text="Test task",
            state=TaskState.PENDING,
            priority=Priority.HIGH,
            user_id="user-456",
            task_repo=repo,
        )
        assert task.id == "client-uuid-123"
        assert task.workspace_id == "ws-123"
        assert task.text == "Test task"
        assert task.state == TaskState.PENDING
        assert task.priority == Priority.HIGH

    @pytest.mark.asyncio
    async def test_preserves_all_fields(self):
        repo = MockTaskRepository()
        due = datetime(2026, 5, 1, 12, 0, 0)
        task = await create_task(
            task_id="task-123",
            workspace_id="ws-123",
            text="Important task",
            state=TaskState.WORKING,
            priority=Priority.MEDIUM,
            user_id="user-456",
            task_repo=repo,
            list_id="list-123",
            assignee_id="user-789",
            due_date=due,
            description="A description",
            tags=["bug", "urgent"],
        )
        assert task.list_id == "list-123"
        assert task.assignee_id == "user-789"
        assert task.due_date == due
        assert task.description == "A description"
        assert task.tags == ["bug", "urgent"]


class TestListTasks:
    @pytest.mark.asyncio
    async def test_returns_only_workspace_tasks(self):
        repo = MockTaskRepository()
        await create_task("task-1", "ws-1", "Task 1", TaskState.PENDING, Priority.LOW, "user-1", repo)
        await create_task("task-2", "ws-2", "Task 2", TaskState.PENDING, Priority.LOW, "user-1", repo)
        await create_task("task-3", "ws-1", "Task 3", TaskState.PENDING, Priority.LOW, "user-1", repo)

        tasks = await list_tasks("ws-1", repo)
        assert len(tasks) == 2
        assert all(t.workspace_id == "ws-1" for t in tasks)

    @pytest.mark.asyncio
    async def test_empty_for_unknown_workspace(self):
        repo = MockTaskRepository()
        tasks = await list_tasks("ws-unknown", repo)
        assert len(tasks) == 0


class TestUpdateTask:
    @pytest.mark.asyncio
    async def test_updates_fields(self):
        repo = MockTaskRepository()
        await create_task("task-1", "ws-1", "Original", TaskState.PENDING, Priority.LOW, "user-1", repo)

        updated = await update_task(
            task_id="task-1",
            workspace_id="ws-1",
            task_repo=repo,
            text="Updated",
            state=TaskState.WORKING,
            priority=Priority.HIGH,
        )
        assert updated.text == "Updated"
        assert updated.state == TaskState.WORKING
        assert updated.priority == Priority.HIGH

    @pytest.mark.asyncio
    async def test_sets_completed_at_when_done(self):
        repo = MockTaskRepository()
        await create_task("task-1", "ws-1", "Task", TaskState.PENDING, Priority.LOW, "user-1", repo)

        updated = await update_task("task-1", "ws-1", repo, state=TaskState.DONE)
        assert updated.completed_at is not None

    @pytest.mark.asyncio
    async def test_not_found_for_other_workspace(self):
        repo = MockTaskRepository()
        await create_task("task-1", "ws-1", "Task", TaskState.PENDING, Priority.LOW, "user-1", repo)

        with pytest.raises(TaskNotFound):
            await update_task("task-1", "ws-2", task_repo=repo)

    @pytest.mark.asyncio
    async def test_not_found_for_missing_task(self):
        repo = MockTaskRepository()
        with pytest.raises(TaskNotFound):
            await update_task("missing-task", "ws-1", task_repo=repo)


class TestDeleteTask:
    @pytest.mark.asyncio
    async def test_deletes_existing_task(self):
        repo = MockTaskRepository()
        await create_task("task-1", "ws-1", "Task", TaskState.PENDING, Priority.LOW, "user-1", repo)

        result = await delete_task("task-1", "ws-1", repo)
        assert result is True
        assert await repo.find_by_id("task-1") is None

    @pytest.mark.asyncio
    async def test_not_found_for_other_workspace(self):
        repo = MockTaskRepository()
        await create_task("task-1", "ws-1", "Task", TaskState.PENDING, Priority.LOW, "user-1", repo)

        with pytest.raises(TaskNotFound):
            await delete_task("task-1", "ws-2", repo)

    @pytest.mark.asyncio
    async def test_not_found_for_missing_task(self):
        repo = MockTaskRepository()
        with pytest.raises(TaskNotFound):
            await delete_task("missing-task", "ws-1", repo)


class TestCreateTaskList:
    @pytest.mark.asyncio
    async def test_creates_task_list_with_client_generated_id(self):
        repo = MockTaskListRepository()
        tl = await create_task_list(
            list_id="list-123",
            workspace_id="ws-123",
            name="My List",
            user_id="user-456",
            task_list_repo=repo,
        )
        assert tl.id == "list-123"
        assert tl.workspace_id == "ws-123"
        assert tl.name == "My List"


class TestListTaskLists:
    @pytest.mark.asyncio
    async def test_returns_only_workspace_lists(self):
        repo = MockTaskListRepository()
        await create_task_list("list-1", "ws-1", "List 1", "user-1", repo)
        await create_task_list("list-2", "ws-2", "List 2", "user-1", repo)
        await create_task_list("list-3", "ws-1", "List 3", "user-1", repo)

        lists = await list_task_lists("ws-1", repo)
        assert len(lists) == 2
        assert all(tl.workspace_id == "ws-1" for tl in lists)

    @pytest.mark.asyncio
    async def test_empty_for_unknown_workspace(self):
        repo = MockTaskListRepository()
        lists = await list_task_lists("ws-unknown", repo)
        assert len(lists) == 0