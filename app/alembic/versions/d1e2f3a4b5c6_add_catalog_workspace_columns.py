"""add catalog workspace status columns

Revision ID: d1e2f3a4b5c6
Revises: c9d8e7f6a5b4
Create Date: 2026-05-10

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d1e2f3a4b5c6"
down_revision: Union[str, None] = "c9d8e7f6a5b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "catalogs",
        sa.Column("workspace_status", sa.String(length=32), nullable=True),
    )
    op.add_column(
        "catalogs",
        sa.Column("last_exported_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "catalogs",
        sa.Column("last_export_error", sa.Text(), nullable=True),
    )
    op.add_column(
        "catalogs",
        sa.Column("export_revision", sa.BigInteger(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("catalogs", "export_revision")
    op.drop_column("catalogs", "last_export_error")
    op.drop_column("catalogs", "last_exported_at")
    op.drop_column("catalogs", "workspace_status")
