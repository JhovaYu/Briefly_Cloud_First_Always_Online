from fastapi import APIRouter, Depends, HTTPException, status

from app.api.schemas import (
    CreateTaskListRequest,
    TaskListResponse,
    TaskListListResponse,
    CreateTaskRequest,
    UpdateTaskRequest,
    TaskResponse,
    TasksListResponse,
)
from app.api.dependencies import get_current_user, get_workspace_client, require_workspace_access
from app.api.db_session import get_db, DBSession
from app.ports.workspace_permissions import WorkspacePermissions
from app.use_cases import create_task_list, list_task_lists, create_task, list_tasks, update_task, delete_task
from app.domain.errors import TaskNotFound, DuplicateResourceError

router = APIRouter()


@router.get("/workspaces/{workspace_id}/task-lists", response_model=TaskListListResponse)
async def get_task_lists(
    workspace_id: str,
    auth_user=Depends(get_current_user),
    db: DBSession = Depends(get_db),
    workspace_client: WorkspacePermissions = Depends(get_workspace_client),
):
    await require_workspace_access(workspace_id, auth_user, workspace_client)
    lists = await list_task_lists(workspace_id, db.task_list_repo)
    return TaskListListResponse(
        task_lists=[
            TaskListResponse(
                id=tl.id,
                workspace_id=tl.workspace_id,
                name=tl.name,
                color=tl.color,
                created_at=tl.created_at,
                updated_at=tl.updated_at,
                created_by=tl.created_by,
            )
            for tl in lists
        ]
    )


@router.post("/workspaces/{workspace_id}/task-lists", response_model=TaskListResponse, status_code=status.HTTP_201_CREATED)
async def create_task_list_endpoint(
    workspace_id: str,
    req: CreateTaskListRequest,
    auth_user=Depends(get_current_user),
    db: DBSession = Depends(get_db),
    workspace_client: WorkspacePermissions = Depends(get_workspace_client),
):
    await require_workspace_access(workspace_id, auth_user, workspace_client)
    try:
        task_list = await create_task_list(
            list_id=req.id,
            workspace_id=workspace_id,
            name=req.name,
            color=req.color,
            user_id=auth_user.payload.sub,
            task_list_repo=db.task_list_repo,
        )
    except DuplicateResourceError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    # Commit is handled by DBSession.__aexit__ on success
    return TaskListResponse(
        id=task_list.id,
        workspace_id=task_list.workspace_id,
        name=task_list.name,
        color=task_list.color,
        created_at=task_list.created_at,
        updated_at=task_list.updated_at,
        created_by=task_list.created_by,
    )


@router.get("/workspaces/{workspace_id}/tasks", response_model=TasksListResponse)
async def get_tasks(
    workspace_id: str,
    date: str | None = None,
    auth_user=Depends(get_current_user),
    db: DBSession = Depends(get_db),
    workspace_client: WorkspacePermissions = Depends(get_workspace_client),
):
    await require_workspace_access(workspace_id, auth_user, workspace_client)
    if date:
        from datetime import date as date_class
        try:
            date_class.fromisoformat(date)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid date format. Expected YYYY-MM-DD",
            )
    tasks = await list_tasks(workspace_id, db.task_repo, due_date=date)
    return TasksListResponse(
        tasks=[
            TaskResponse(
                id=t.id,
                workspace_id=t.workspace_id,
                list_id=t.list_id,
                text=t.text,
                state=t.state,
                priority=t.priority,
                assignee_id=t.assignee_id,
                due_date=t.due_date,
                description=t.description,
                tags=t.tags,
                created_at=t.created_at,
                updated_at=t.updated_at,
                completed_at=t.completed_at,
                created_by=t.created_by,
            )
            for t in tasks
        ]
    )


@router.post("/workspaces/{workspace_id}/tasks", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task_endpoint(
    workspace_id: str,
    req: CreateTaskRequest,
    auth_user=Depends(get_current_user),
    db: DBSession = Depends(get_db),
    workspace_client: WorkspacePermissions = Depends(get_workspace_client),
):
    await require_workspace_access(workspace_id, auth_user, workspace_client)
    try:
        task = await create_task(
            task_id=req.id,
            workspace_id=workspace_id,
            text=req.text,
            state=req.state,
            priority=req.priority,
            user_id=auth_user.payload.sub,
            task_repo=db.task_repo,
            list_id=req.list_id,
            assignee_id=req.assignee_id,
            due_date=req.due_date,
            description=req.description,
            tags=req.tags,
        )
    except DuplicateResourceError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    # Commit is handled by DBSession.__aexit__ on success
    return TaskResponse(
        id=task.id,
        workspace_id=task.workspace_id,
        list_id=task.list_id,
        text=task.text,
        state=task.state,
        priority=task.priority,
        assignee_id=task.assignee_id,
        due_date=task.due_date,
        description=task.description,
        tags=task.tags,
        created_at=task.created_at,
        updated_at=task.updated_at,
        completed_at=task.completed_at,
        created_by=task.created_by,
    )


@router.put("/workspaces/{workspace_id}/tasks/{task_id}", response_model=TaskResponse)
async def update_task_endpoint(
    workspace_id: str,
    task_id: str,
    req: UpdateTaskRequest,
    auth_user=Depends(get_current_user),
    db: DBSession = Depends(get_db),
    workspace_client: WorkspacePermissions = Depends(get_workspace_client),
):
    await require_workspace_access(workspace_id, auth_user, workspace_client)
    try:
        task = await update_task(
            task_id=task_id,
            workspace_id=workspace_id,
            task_repo=db.task_repo,
            list_id=req.list_id,
            text=req.text,
            state=req.state,
            priority=req.priority,
            assignee_id=req.assignee_id,
            due_date=req.due_date,
            description=req.description,
            tags=req.tags,
        )
    except TaskNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    # Commit is handled by DBSession.__aexit__ on success
    return TaskResponse(
        id=task.id,
        workspace_id=task.workspace_id,
        list_id=task.list_id,
        text=task.text,
        state=task.state,
        priority=task.priority,
        assignee_id=task.assignee_id,
        due_date=task.due_date,
        description=task.description,
        tags=task.tags,
        created_at=task.created_at,
        updated_at=task.updated_at,
        completed_at=task.completed_at,
        created_by=task.created_by,
    )


@router.delete("/workspaces/{workspace_id}/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task_endpoint(
    workspace_id: str,
    task_id: str,
    auth_user=Depends(get_current_user),
    db: DBSession = Depends(get_db),
    workspace_client: WorkspacePermissions = Depends(get_workspace_client),
):
    await require_workspace_access(workspace_id, auth_user, workspace_client)
    try:
        await delete_task(task_id=task_id, workspace_id=workspace_id, task_repo=db.task_repo)
    except TaskNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")