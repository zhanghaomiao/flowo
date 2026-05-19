"""add user role for demo viewer accounts

Revision ID: f1a2b3c4d5e6
Revises: d5e6f7a8b9c0
Create Date: 2026-05-19

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "f1a2b3c4d5e6"
down_revision: str | None = "d5e6f7a8b9c0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "user",
        sa.Column("role", sa.String(), server_default="user", nullable=False),
    )
    op.execute("UPDATE \"user\" SET role = 'admin' WHERE is_superuser IS TRUE")


def downgrade() -> None:
    op.drop_column("user", "role")
