"""catalog slug unique per owner

Revision ID: f8a1c2d3e4b5
Revises: 3602ee30de87
Create Date: 2026-05-09

"""
from typing import Sequence, Union

from alembic import op

revision: str = "f8a1c2d3e4b5"
down_revision: Union[str, None] = "3602ee30de87"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index(op.f("ix_catalogs_slug"), table_name="catalogs")
    op.create_index(op.f("ix_catalogs_slug"), "catalogs", ["slug"], unique=False)
    op.execute(
        "CREATE UNIQUE INDEX uq_catalogs_owner_slug "
        "ON catalogs (owner_id, slug) NULLS NOT DISTINCT"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_catalogs_owner_slug")
    op.drop_index(op.f("ix_catalogs_slug"), table_name="catalogs")
    op.create_index(
        op.f("ix_catalogs_slug"), "catalogs", ["slug"], unique=True
    )
