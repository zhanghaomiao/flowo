"""user_tokens: store HMAC-SHA256 hash instead of plaintext

Revision ID: b2c3d4e5f6a7
Revises: e4f5a6b7c8d9
Create Date: 2026-05-10

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy import text

revision: str = "b2c3d4e5f6a7"
down_revision: str | None = "e4f5a6b7c8d9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "user_tokens",
        sa.Column("token_hash", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "user_tokens",
        sa.Column("token_prefix", sa.String(length=32), nullable=True),
    )

    from app.core.config import settings
    from app.utils.user_api_token_crypto import build_token_prefix, hash_user_token

    conn = op.get_bind()
    rows = conn.execute(text("SELECT id, token FROM user_tokens")).fetchall()
    for row in rows:
        row_id, plain = row[0], row[1]
        digest = hash_user_token(plain, secret=settings.SECRET_KEY)
        prefix = build_token_prefix(plain)
        conn.execute(
            text(
                "UPDATE user_tokens SET token_hash = :h, token_prefix = :p "
                "WHERE id = :id"
            ),
            {"h": digest, "p": prefix, "id": row_id},
        )

    op.alter_column("user_tokens", "token_hash", nullable=False)
    op.alter_column("user_tokens", "token_prefix", nullable=False)

    op.drop_index(op.f("ix_user_tokens_token"), table_name="user_tokens")
    op.create_index(
        op.f("ix_user_tokens_token_hash"),
        "user_tokens",
        ["token_hash"],
        unique=True,
    )
    op.drop_column("user_tokens", "token")


def downgrade() -> None:
    op.add_column(
        "user_tokens",
        sa.Column("token", sa.String(), nullable=True),
    )
    op.drop_index(op.f("ix_user_tokens_token_hash"), table_name="user_tokens")
    op.create_index(
        op.f("ix_user_tokens_token"),
        "user_tokens",
        ["token"],
        unique=True,
    )
    op.drop_column("user_tokens", "token_hash")
    op.drop_column("user_tokens", "token_prefix")
