class WorkspaceError(Exception):
    """Base exception for workspace errors"""
    pass


class WorkspaceNotFound(WorkspaceError):
    """Workspace does not exist or user has no access"""
    pass


class MembershipNotFound(WorkspaceError):
    """User is not a member of the workspace"""
    pass


class Unauthorized(WorkspaceError):
    """Token invalid or expired"""
    pass


class AuthServiceUnavailable(WorkspaceError):
    """JWKS/Supabase auth service unavailable"""
    pass
