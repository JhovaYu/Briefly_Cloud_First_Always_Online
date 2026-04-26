from abc import ABC, abstractmethod
from app.domain.document_metadata import DocumentMetadata


class DocumentRepository(ABC):
    @abstractmethod
    async def create(self, document: DocumentMetadata) -> DocumentMetadata: ...

    @abstractmethod
    async def list_by_workspace(self, workspace_id: str) -> list[DocumentMetadata]: ...
