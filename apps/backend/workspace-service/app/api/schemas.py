from pydantic import BaseModel, ConfigDict, Field


class CreateWorkspaceRequest(BaseModel):
    name: str


class WorkspaceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    owner_id: str
    created_at: str
    updated_at: str


class WorkspaceListResponse(BaseModel):
    workspaces: list[WorkspaceResponse]


class CreateDocumentRequest(BaseModel):
    title: str


class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    workspace_id: str
    title: str
    created_by: str
    created_at: str
    updated_at: str


class DocumentListResponse(BaseModel):
    documents: list[DocumentResponse]


class PermissionsResponse(BaseModel):
    workspace_id: str
    user_id: str
    role: str


class MeResponse(BaseModel):
    user_id: str
    email: str | None = None


class SharedTextResponse(BaseModel):
    workspace_id: str
    content: str
    updated_by: str | None = None
    updated_at: str
    version: int


class UpdateSharedTextRequest(BaseModel):
    content: str = Field(..., max_length=50000)
