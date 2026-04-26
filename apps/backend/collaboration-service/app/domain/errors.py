class CollaborationError(Exception):
    """Base exception for collaboration errors"""
    pass


class AuthTimeout(CollaborationError):
    """First message auth timed out"""
    pass


class InvalidAuthMessage(CollaborationError):
    """First message was not a valid auth message"""
    pass


class PermissionDenied(CollaborationError):
    """User does not have access to the workspace"""
    pass


class UpstreamUnavailable(CollaborationError):
    """Workspace service unavailable or timed out"""
    pass
