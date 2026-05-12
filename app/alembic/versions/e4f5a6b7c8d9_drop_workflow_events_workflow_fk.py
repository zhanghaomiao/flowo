"""drop workflow_events workflow foreign key

Revision ID: e4f5a6b7c8d9
Revises: d1e2f3a4b5c6
Create Date: 2026-05-10

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e4f5a6b7c8d9"
down_revision: Union[str, None] = "d1e2f3a4b5c6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint(
        "workflow_events_workflow_id_fkey",
        "workflow_events",
        type_="foreignkey",
    )


def downgrade() -> None:
    op.create_foreign_key(
        "workflow_events_workflow_id_fkey",
        "workflow_events",
        "workflows",
        ["workflow_id"],
        ["id"],
        ondelete="SET NULL",
    )
