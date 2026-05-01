class Unauthorized(Exception):
    pass


class AuthServiceUnavailable(Exception):
    pass


class ScheduleBlockNotFound(Exception):
    pass


class DuplicateResourceError(Exception):
    pass