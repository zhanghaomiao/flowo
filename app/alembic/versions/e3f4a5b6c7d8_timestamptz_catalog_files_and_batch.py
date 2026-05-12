"""Use TIMESTAMPTZ for catalog file and batch import datetimes

Revision ID: e3f4a5b6c7d8
Revises: ab4bc3ac69db
Create Date: 2026-05-08

Python uses timezone-aware UTC (datetime.now(UTC)); asyncpg errors when
binding those to TIMESTAMP WITHOUT TIME ZONE (naive).
"""

from typing import Sequence, Union

from alembic import op


revision: str = "e3f4a5b6c7d8"
down_revision: Union[str, None] = "ab4bc3ac69db"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Interpret existing naive timestamps as UTC wall time (matches prior app usage).
    op.execute(
        """
        ALTER TABLE catalog_files
          ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE
            USING created_at AT TIME ZONE 'UTC',
          ALTER COLUMN last_modified_at TYPE TIMESTAMP WITH TIME ZONE
            USING last_modified_at AT TIME ZONE 'UTC';
        """
    )
    op.execute(
        """
        ALTER TABLE catalog_file_versions
          ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE
            USING created_at AT TIME ZONE 'UTC';
        """
    )
    op.execute(
        """
        ALTER TABLE batch_imports
          ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE
            USING created_at AT TIME ZONE 'UTC',
          ALTER COLUMN completed_at TYPE TIMESTAMP WITH TIME ZONE
            USING completed_at AT TIME ZONE 'UTC';
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE catalog_files
          ALTER COLUMN created_at TYPE TIMESTAMP WITHOUT TIME ZONE
            USING created_at AT TIME ZONE 'UTC',
          ALTER COLUMN last_modified_at TYPE TIMESTAMP WITHOUT TIME ZONE
            USING last_modified_at AT TIME ZONE 'UTC';
        """
    )
    op.execute(
        """
        ALTER TABLE catalog_file_versions
          ALTER COLUMN created_at TYPE TIMESTAMP WITHOUT TIME ZONE
            USING created_at AT TIME ZONE 'UTC';
        """
    )
    op.execute(
        """
        ALTER TABLE batch_imports
          ALTER COLUMN created_at TYPE TIMESTAMP WITHOUT TIME ZONE
            USING created_at AT TIME ZONE 'UTC',
          ALTER COLUMN completed_at TYPE TIMESTAMP WITHOUT TIME ZONE
            USING completed_at AT TIME ZONE 'UTC';
        """
    )
