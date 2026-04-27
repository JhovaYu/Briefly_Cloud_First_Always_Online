class PlanningError(Exception):
    """Base exception for planning errors"""
    pass


class TaskNotFound(PlanningError):
    """Task does not exist"""
    pass


class TaskListNotFound(PlanningError):
    """TaskList does not exist"""
    pass


class Unauthorized(PlanningError):
    """Token invalid or expired"""
    pass


class AuthServiceUnavailable(PlanningError):
    """JWKS/Supabase auth service unavailable"""
    pass