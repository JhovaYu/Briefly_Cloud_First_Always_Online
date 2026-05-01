from abc import ABC, abstractmethod
from app.domain.schedule_block import ScheduleBlock


class ScheduleBlockRepository(ABC):
    @abstractmethod
    async def create(self, block: ScheduleBlock) -> ScheduleBlock: ...

    @abstractmethod
    async def list_by_workspace(self, workspace_id: str) -> list[ScheduleBlock]: ...

    @abstractmethod
    async def get_by_id(self, block_id: str, workspace_id: str) -> ScheduleBlock | None: ...

    @abstractmethod
    async def update(self, block_id: str, workspace_id: str, **kwargs) -> ScheduleBlock: ...

    @abstractmethod
    async def delete(self, block_id: str, workspace_id: str) -> None: ...