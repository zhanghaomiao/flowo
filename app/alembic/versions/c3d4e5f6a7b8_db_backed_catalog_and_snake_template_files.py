"""db-backed catalog_files and snake template file tables

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-05-11

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "c3d4e5f6a7b8"
down_revision: str | None = "b2c3d4e5f6a7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "catalog_files",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("catalog_id", sa.Uuid(), nullable=False),
        sa.Column("path", sa.Text(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=False),
        sa.Column("size", sa.BigInteger(), nullable=False),
        sa.Column("lines", sa.Integer(), nullable=False),
        sa.Column("language", sa.String(length=128), nullable=True),
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
            name=op.f("catalog_files_catalog_id_fkey"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("catalog_files_pkey")),
        sa.UniqueConstraint(
            "catalog_id",
            "path",
            name="uq_catalog_files_catalog_path",
        ),
    )
    op.create_index(
        op.f("ix_catalog_files_catalog_id"),
        "catalog_files",
        ["catalog_id"],
        unique=False,
    )
    op.create_index(
        "ix_catalog_files_catalog_id_path",
        "catalog_files",
        ["catalog_id", "path"],
        unique=False,
    )

    op.create_table(
        "snake_template_files",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("path", sa.Text(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=False),
        sa.Column("size", sa.BigInteger(), nullable=False),
        sa.Column("lines", sa.Integer(), nullable=False),
        sa.Column("language", sa.String(length=128), nullable=True),
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
        sa.PrimaryKeyConstraint("id", name=op.f("snake_template_files_pkey")),
        sa.UniqueConstraint("path", name="uq_snake_template_files_path"),
    )
    op.create_index(
        op.f("ix_snake_template_files_path"),
        "snake_template_files",
        ["path"],
        unique=False,
    )

    op.create_table(
        "snake_template_state",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("upstream_url", sa.Text(), nullable=True),
        sa.Column("source_ref", sa.String(length=512), nullable=True),
        sa.Column("last_pulled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id", name=op.f("snake_template_state_pkey")),
    )


def downgrade() -> None:
    op.drop_table("snake_template_state")
    op.drop_index(op.f("ix_snake_template_files_path"), table_name="snake_template_files")
    op.drop_table("snake_template_files")
    op.drop_index("ix_catalog_files_catalog_id_path", table_name="catalog_files")
    op.drop_index(op.f("ix_catalog_files_catalog_id"), table_name="catalog_files")
    op.drop_table("catalog_files")
