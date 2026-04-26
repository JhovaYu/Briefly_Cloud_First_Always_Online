from pydantic import BaseModel


class CreateWorkspaceRequest(BaseModel):
    name: str


class WorkspaceResponse(BaseModel):
    id: str
    name: str
    owner_id: str
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class WorkspaceListResponse(BaseModel):
    workspaces: list[WorkspaceResponse]


class CreateDocumentRequest(BaseModel):
    title: str


class DocumentResponse(BaseModel):
    id: str
    workspace_id: str
    title: str
    created_by: str
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class DocumentListResponse(BaseModel):
    documents: list[DocumentResponse]


class PermissionsResponse(BaseModel):
    workspace_id: str
    user_id: str
    role: str


class MeResponse(BaseModel):
    user_id: str
    email: str | None = None
