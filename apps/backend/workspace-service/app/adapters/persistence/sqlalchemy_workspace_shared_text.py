from datetime import datetime
from sqlalchemy import Column, String, Text, Integer, DateTime
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class WorkspaceSharedTextModel(Base):
    __tablename__ = "workspace_shared_text"

    workspace_id = Column(String(36), primary_key=True)
    content = Column(Text, nullable=False, default="")
    updated_by = Column(String(36), nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    version = Column(Integer, nullable=False, default=1)