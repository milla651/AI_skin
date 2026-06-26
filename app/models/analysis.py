"""Analysis SQLAlchemy model."""
from __future__ import annotations

import os
import uuid
from datetime import datetime

from sqlalchemy.dialects.postgresql import JSONB, UUID

from ..extensions import db

# Resolved once at import time. Using env var keeps the model usable from
# both Flask request context and Celery workers.
_SCHEMA = os.getenv("DB_SCHEMA", "ai_skin")


class Analysis(db.Model):
    __tablename__ = "analyses"
    __table_args__ = {"schema": _SCHEMA}

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    status = db.Column(db.String(32), nullable=False, default="pending")
    image_path = db.Column(db.String(512), nullable=False)
    annotated_path = db.Column(db.String(512), nullable=True)
    result = db.Column(JSONB, nullable=True)
    error = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "status": self.status,
            "image_path": self.image_path,
            "annotated_path": self.annotated_path,
            "result": self.result,
            "error": self.error,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
