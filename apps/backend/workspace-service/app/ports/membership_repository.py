from abc import ABC, abstractmethod
from app.domain.membership import Membership


class MembershipRepository(ABC):
    @abstractmethod
    async def create(self, membership: Membership) -> Membership: ...

    @abstractmethod
    async def get_by_workspace_and_user(self, workspace_id: str, user_id: str) -> Membership | None: ...

    @abstractmethod
    async def list_by_workspace(self, workspace_id: str) -> list[Membership]: ...

    @abstractmethod
    async def list_by_user(self, user_id: str) -> list[Membership]: ...
