"""add catalog_blobs for binary sidecar storage

Revision ID: d5e6f7a8b9c0
Revises: c3d4e5f6a7b8
Create Date: 2026-05-12

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "d5e6f7a8b9c0"
down_revision: str | None = "c3d4e5f6a7b8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "catalog_blobs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("catalog_id", sa.Uuid(), nullable=False),
        sa.Column("path", sa.Text(), nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=False),
        sa.Column("size", sa.BigInteger(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["catalog_id"],
            ["catalogs.id"],
            name=op.f("catalog_blobs_catalog_id_fkey"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("catalog_blobs_pkey")),
        sa.UniqueConstraint(
            "catalog_id",
            "path",
            name="uq_catalog_blobs_catalog_path",
        ),
    )
    op.create_index(
        op.f("ix_catalog_blobs_catalog_id"),
        "catalog_blobs",
        ["catalog_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_catalog_blobs_catalog_id"), table_name="catalog_blobs")
    op.drop_table("catalog_blobs")
