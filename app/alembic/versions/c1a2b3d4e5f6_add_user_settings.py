"""add user_settings table

Revision ID: c1a2b3d4e5f6
Revises: 8b3ac7e7b37c
Create Date: 2026-02-27 09:26:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "c1a2b3d4e5f6"
down_revision: str | None = "8b3ac7e7b37c"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add user_settings table."""
    # Use execute with IF NOT EXISTS so a partial migration doesn't break re-runs
    op.execute("""
        CREATE TABLE IF NOT EXISTS user_settings (
            id UUID NOT NULL,
            user_id UUID NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
            git_remote_url TEXT,
            git_token TEXT,
            smtp_host VARCHAR(255),
            smtp_port INTEGER,
            smtp_user VARCHAR(255),
            smtp_password TEXT,
            smtp_from VARCHAR(255),
            smtp_use_tls BOOLEAN,
            extra JSONB,
            PRIMARY KEY (id)
        )
    """)
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS ix_user_settings_user_id
        ON user_settings (user_id)
    """)


def downgrade() -> None:
    """Drop user_settings table."""
    op.execute("DROP INDEX IF EXISTS ix_user_settings_user_id")
    op.execute("DROP TABLE IF EXISTS user_settings")
