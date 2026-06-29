"""Add device_id and local_date columns for Phase 2 longitudinal tracking.

Revision ID: 002_device_id
Revises: fb8beace83a7
Create Date: 2026-06-28
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import os

TARGET_SCHEMA = os.getenv("DB_SCHEMA", "ai_skin")

# revision identifiers, used by Alembic.
revision = "002_device_id"
down_revision = "fb8beace83a7"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "analyses",
        sa.Column("device_id", postgresql.UUID(as_uuid=True), nullable=True),
        schema=TARGET_SCHEMA,
    )
    op.add_column(
        "analyses",
        sa.Column("local_date", sa.Date(), nullable=True),
        schema=TARGET_SCHEMA,
    )
    op.create_index(
        "ix_analyses_device_created",
        "analyses",
        ["device_id", sa.text("created_at DESC")],
        schema=TARGET_SCHEMA,
    )
    op.create_index(
        "ix_analyses_device_local_date",
        "analyses",
        ["device_id", "local_date"],
        schema=TARGET_SCHEMA,
    )


def downgrade():
    op.drop_index("ix_analyses_device_local_date", table_name="analyses", schema=TARGET_SCHEMA)
    op.drop_index("ix_analyses_device_created", table_name="analyses", schema=TARGET_SCHEMA)
    op.drop_column("analyses", "local_date", schema=TARGET_SCHEMA)
    op.drop_column("analyses", "device_id", schema=TARGET_SCHEMA)
