from collections import defaultdict
from datetime import datetime, timezone

from app.domain.schedule_block import ScheduleBlock
from app.ports.schedule_block_repository import ScheduleBlockRepository


class InMemoryScheduleBlockRepository(ScheduleBlockRepository):
    def __init__(self):
        self._blocks: dict[str, ScheduleBlock] = {}
        self._by_workspace: dict[str, list[str]] = defaultdict(list)

    async def create(self, block: ScheduleBlock) -> ScheduleBlock:
        self._blocks[block.id] = block
        self._by_workspace[block.workspace_id].append(block.id)
        return block

    async def list_by_workspace(self, workspace_id: str) -> list[ScheduleBlock]:
        ids = self._by_workspace.get(workspace_id, [])
        return [self._blocks[bid] for bid in ids if bid in self._blocks]

    async def get_by_id(self, block_id: str, workspace_id: str) -> ScheduleBlock | None:
        block = self._blocks.get(block_id)
        if block is None:
            return None
        if block.workspace_id != workspace_id:
            return None
        return block

    async def update(self, block_id: str, workspace_id: str, **kwargs) -> ScheduleBlock:
        block = await self.get_by_id(block_id, workspace_id)
        if block is None:
            raise LookupError(f"ScheduleBlock {block_id} not found in workspace {workspace_id}")

        for key, value in kwargs.items():
            if value is not None and hasattr(block, key):
                setattr(block, key, value)
        block.updated_at = datetime.now(timezone.utc)
        return block

    async def delete(self, block_id: str, workspace_id: str) -> None:
        block = await self.get_by_id(block_id, workspace_id)
        if block is None:
            raise LookupError(f"ScheduleBlock {block_id} not found in workspace {workspace_id}")
        del self._blocks[block_id]
        self._by_workspace[workspace_id] = [
            bid for bid in self._by_workspace[workspace_id] if bid != block_id
        ]