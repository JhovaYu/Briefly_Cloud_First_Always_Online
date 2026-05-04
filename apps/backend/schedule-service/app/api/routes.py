from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query

from app.api.schemas import (
    CreateScheduleBlockRequest,
    UpdateScheduleBlockRequest,
    ScheduleBlockResponse,
    ScheduleBlockListResponse,
)
from app.api.dependencies import get_current_user, get_db, require_workspace_access, AuthenticatedUser, get_workspace_client, ScheduleDBSession
from app.ports.workspace_permissions import WorkspacePermissions
from app.ports.schedule_block_repository import ScheduleBlockRepository
from app.domain.errors import ScheduleBlockNotFound, DuplicateResourceError
from app.use_cases import list_schedule_blocks_for_date

router = APIRouter()


@router.get("/workspaces/{workspace_id}/schedule-blocks", response_model=ScheduleBlockListResponse)
async def get_schedule_blocks(
    workspace_id: str,
    date: str | None = Query(None, description="YYYY-MM-DD. Defaults to all blocks if omitted."),
    auth_user: AuthenticatedUser = Depends(get_current_user),
    workspace_client: WorkspacePermissions = Depends(get_workspace_client),
    db: ScheduleDBSession = Depends(get_db),
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
    blocks = await list_schedule_blocks_for_date(workspace_id, db.block_repo, date=date)
    return ScheduleBlockListResponse(
        blocks=[
            ScheduleBlockResponse(
                id=b.id,
                workspace_id=b.workspace_id,
                title=b.title,
                day_of_week=b.day_of_week,
                start_time=b.start_time,
                duration_minutes=b.duration_minutes,
                color=b.color,
                location=b.location,
                notes=b.notes,
                created_at=b.created_at,
                updated_at=b.updated_at,
                created_by=b.created_by,
            )
            for b in sorted(blocks, key=lambda b: (b.day_of_week, b.start_time))
        ]
    )


@router.post("/workspaces/{workspace_id}/schedule-blocks", response_model=ScheduleBlockResponse, status_code=status.HTTP_201_CREATED)
async def create_schedule_block(
    workspace_id: str,
    req: CreateScheduleBlockRequest,
    auth_user: AuthenticatedUser = Depends(get_current_user),
    workspace_client: WorkspacePermissions = Depends(get_workspace_client),
    db: ScheduleDBSession = Depends(get_db),
):
    await require_workspace_access(workspace_id, auth_user, workspace_client)

    # Check for duplicate ID within workspace
    existing = await db.block_repo.get_by_id(req.id, workspace_id)
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="ScheduleBlock with this ID already exists")

    now = datetime.now(timezone.utc)
    block = ScheduleBlock(
        id=req.id,
        workspace_id=workspace_id,
        title=req.title,
        day_of_week=req.day_of_week,
        start_time=req.start_time,
        duration_minutes=req.duration_minutes,
        color=req.color,
        location=req.location,
        notes=req.notes,
        created_at=now,
        updated_at=now,
        created_by=auth_user.payload.sub,
    )
    created = await db.block_repo.create(block)
    return ScheduleBlockResponse(
        id=created.id,
        workspace_id=created.workspace_id,
        title=created.title,
        day_of_week=created.day_of_week,
        start_time=created.start_time,
        duration_minutes=created.duration_minutes,
        color=created.color,
        location=created.location,
        notes=created.notes,
        created_at=created.created_at,
        updated_at=created.updated_at,
        created_by=created.created_by,
    )


@router.put("/workspaces/{workspace_id}/schedule-blocks/{block_id}", response_model=ScheduleBlockResponse)
async def update_schedule_block(
    workspace_id: str,
    block_id: str,
    req: UpdateScheduleBlockRequest,
    auth_user: AuthenticatedUser = Depends(get_current_user),
    workspace_client: WorkspacePermissions = Depends(get_workspace_client),
    db: ScheduleDBSession = Depends(get_db),
):
    await require_workspace_access(workspace_id, auth_user, workspace_client)

    # Build update dict excluding None values
    update_data = {
        k: v for k, v in {
            "title": req.title,
            "day_of_week": req.day_of_week,
            "start_time": req.start_time,
            "duration_minutes": req.duration_minutes,
            "color": req.color,
            "location": req.location,
            "notes": req.notes,
        }.items() if v is not None
    }

    try:
        updated = await db.block_repo.update(block_id, workspace_id, **update_data)
    except LookupError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ScheduleBlock not found")

    return ScheduleBlockResponse(
        id=updated.id,
        workspace_id=updated.workspace_id,
        title=updated.title,
        day_of_week=updated.day_of_week,
        start_time=updated.start_time,
        duration_minutes=updated.duration_minutes,
        color=updated.color,
        location=updated.location,
        notes=updated.notes,
        created_at=updated.created_at,
        updated_at=updated.updated_at,
        created_by=updated.created_by,
    )


@router.delete("/workspaces/{workspace_id}/schedule-blocks/{block_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_schedule_block(
    workspace_id: str,
    block_id: str,
    auth_user: AuthenticatedUser = Depends(get_current_user),
    workspace_client: WorkspacePermissions = Depends(get_workspace_client),
    db: ScheduleDBSession = Depends(get_db),
):
    await require_workspace_access(workspace_id, auth_user, workspace_client)
    try:
        await db.block_repo.delete(block_id, workspace_id)
    except LookupError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ScheduleBlock not found")