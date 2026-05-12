"""add catalog dag preview image columns

Revision ID: a1b2c3d4e5f8
Revises: f8a1c2d3e4b5
Create Date: 2026-05-09

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a1b2c3d4e5f8"
down_revision: Union[str, None] = "f8a1c2d3e4b5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "catalogs",
        sa.Column("dag_preview_mime", sa.String(length=128), nullable=True),
    )
    op.add_column(
        "catalogs",
        sa.Column("dag_preview_bytes", sa.LargeBinary(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("catalogs", "dag_preview_bytes")
    op.drop_column("catalogs", "dag_preview_mime")
