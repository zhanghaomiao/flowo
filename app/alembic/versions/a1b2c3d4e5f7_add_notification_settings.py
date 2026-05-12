"""add notification settings

Revision ID: a1b2c3d4e5f7
Revises: 46f7ce4fa652
Create Date: 2026-04-10 17:14:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f7"
down_revision: str | None = "46f7ce4fa652"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "system_settings",
        sa.Column("notify_on_submit", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "system_settings",
        sa.Column("notify_on_success", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "system_settings",
        sa.Column("notify_on_failure", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "system_settings",
        sa.Column("site_url", sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("system_settings", "site_url")
    op.drop_column("system_settings", "notify_on_failure")
    op.drop_column("system_settings", "notify_on_success")
    op.drop_column("system_settings", "notify_on_submit")
