from datetime import date as date_class
from app.domain.schedule_block import ScheduleBlock
from app.ports.schedule_block_repository import ScheduleBlockRepository


async def list_schedule_blocks(
    workspace_id: str,
    block_repo: ScheduleBlockRepository,
    day_of_week: int | None = None,
) -> list[ScheduleBlock]:
    """List schedule blocks for a workspace, optionally filtered by day_of_week.

    day_of_week: 0=Monday ... 6=Sunday. If None, returns all blocks.
    """
    blocks = await block_repo.list_by_workspace(workspace_id)
    if day_of_week is not None:
        blocks = [b for b in blocks if b.day_of_week == day_of_week]
    return blocks


async def list_schedule_blocks_for_date(
    workspace_id: str,
    block_repo: ScheduleBlockRepository,
    date: str | None = None,
) -> list[ScheduleBlock]:
    """List schedule blocks for a workspace filtered by a specific date.

    date: YYYY-MM-DD string. If None, returns ALL blocks (no day_of_week filter).
    day_of_week is derived from the date (0=Monday ... 6=Sunday).
    """
    if date is None:
        return await list_schedule_blocks(workspace_id, block_repo, day_of_week=None)
    filter_date = date_class.fromisoformat(date)
    dow = filter_date.weekday()  # Python: Monday=0, Sunday=6
    return await list_schedule_blocks(workspace_id, block_repo, day_of_week=dow)
