"""Debug constants shared across collaboration-service modules.

This module must not import from app.api.routes or app.api.crdt_routes.
Keep it dependency-light to avoid circular imports.
"""

CRDT_DEBUG_MARKER = "pm08a-crdt-debug-v1"