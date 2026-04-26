import httpx

from app.domain.errors import PermissionDenied, UpstreamUnavailable
from app.ports.workspace_permissions import WorkspacePermissions


class WorkspacePermissionsClient(WorkspacePermissions):
    def __init__(self, base_url: str, timeout: float):
        self.base_url = base_url
        self.timeout = timeout

    async def check(self, workspace_id: str, token: str) -> dict:
        url = f"{self.base_url}/workspaces/{workspace_id}/permissions"
        headers = {"Authorization": f"Bearer {token}"}
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(url, headers=headers)
        except (httpx.TimeoutException, httpx.ConnectError):
            raise UpstreamUnavailable("Workspace service unavailable")

        if response.status_code == 401:
            raise PermissionDenied("Token invalid or expired")
        if response.status_code == 403:
            raise PermissionDenied("Access denied")
        if response.status_code == 404:
            raise PermissionDenied("Workspace not found")
        if response.status_code >= 500:
            raise UpstreamUnavailable("Workspace service error")

        return response.json()
