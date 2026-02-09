"""init

Revision ID: ba4e3285cd2d
Revises:
Create Date: 2025-06-20 09:27:00.054278

"""

from collections.abc import Sequence
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql
import fastapi_users_db_sqlalchemy

# revision identifiers, used by Alembic.
revision: str = "ba4e3285cd2d"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. Create User table
    op.create_table(
        "user",
        sa.Column("id", fastapi_users_db_sqlalchemy.generics.GUID(), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("hashed_password", sa.String(length=1024), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("is_superuser", sa.Boolean(), nullable=False),
        sa.Column("is_verified", sa.Boolean(), nullable=False),
        sa.Column("name", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_user_email"), "user", ["email"], unique=True)

    # 2. Create Workflows table
    op.create_table(
        "workflows",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("snakefile", sa.String(), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=False),
        sa.Column("end_time", sa.DateTime(), nullable=True),
        sa.Column(
            "status",
            sa.Enum("RUNNING", "SUCCESS", "ERROR", "WAITING", "UNKNOWN", name="status"),
            nullable=True,
        ),
        sa.Column("command_line", sa.String(), nullable=True),
        sa.Column("dryrun", sa.Boolean(), nullable=False),
        sa.Column("rulegraph_data", sa.JSON(), nullable=True),
        sa.Column("logfile", sa.String(), nullable=True),
        sa.Column("user", sa.String(), nullable=True),
        sa.Column("tags", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("name", sa.String(), nullable=True),
        sa.Column("configfiles", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("directory", sa.String(), nullable=True),
        sa.Column("config", sa.JSON(), nullable=True),
        sa.Column("flowo_working_path", sa.String(), nullable=True),
        sa.Column("run_info", sa.JSON(), nullable=True),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )

    # 3. Create Rules table
    op.create_table(
        "rules",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("workflow_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["workflow_id"],
            ["workflows.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # 4. Create Jobs table
    op.create_table(
        "jobs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("snakemake_id", sa.Integer(), nullable=False),
        sa.Column("workflow_id", sa.Uuid(), nullable=False),
        sa.Column("rule_id", sa.Integer(), nullable=True),
        sa.Column("message", sa.String(), nullable=True),
        sa.Column("wildcards", sa.JSON(), nullable=True),
        sa.Column("reason", sa.String(), nullable=True),
        sa.Column("resources", sa.JSON(), nullable=True),
        sa.Column("shellcmd", sa.String(), nullable=True),
        sa.Column("threads", sa.Integer(), nullable=True),
        sa.Column("priority", sa.Integer(), nullable=True),
        sa.Column(
            "status",
            sa.Enum("RUNNING", "SUCCESS", "ERROR", "WAITING", "UNKNOWN", name="status"),
            nullable=False,
        ),
        sa.Column("started_at", sa.DateTime(), nullable=False),
        sa.Column("end_time", sa.DateTime(), nullable=True),
        sa.Column("group_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ["rule_id"],
            ["rules.id"],
        ),
        sa.ForeignKeyConstraint(
            ["workflow_id"],
            ["workflows.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # 5. Create Errors table
    op.create_table(
        "errors",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("timestamp", sa.DateTime(), nullable=False),
        sa.Column("exception", sa.String(), nullable=False),
        sa.Column("location", sa.String(), nullable=True),
        sa.Column("traceback", sa.Text(), nullable=True),
        sa.Column("file", sa.String(), nullable=True),
        sa.Column("line", sa.String(), nullable=True),
        sa.Column("rule_id", sa.Integer(), nullable=True),
        sa.Column("workflow_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["rule_id"],
            ["rules.id"],
        ),
        sa.ForeignKeyConstraint(
            ["workflow_id"],
            ["workflows.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # 6. Create Files table
    op.create_table(
        "files",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("path", sa.String(), nullable=False),
        sa.Column(
            "file_type",
            sa.Enum("INPUT", "OUTPUT", "LOG", "BENCHMARK", name="filetype"),
            nullable=False,
        ),
        sa.Column("job_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["job_id"],
            ["jobs.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # 7. Create User Tokens table
    op.create_table(
        "user_tokens",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("token", sa.String(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_user_tokens_token"), "user_tokens", ["token"], unique=True)

    # 8. Create notification function and triggers
    op.execute("""
    CREATE OR REPLACE FUNCTION notify_table_changes()
    RETURNS trigger AS $$
    DECLARE
        payload JSONB;
        entity_id TEXT;
        workflow_id TEXT;
        workflow_user_id UUID;
        current_record RECORD;

    BEGIN
        IF (TG_OP = 'DELETE') THEN current_record := OLD; ELSE current_record := NEW; END IF;

        -- 1. Get IDs
        IF TG_TABLE_NAME = 'workflows' THEN
            entity_id  := current_record.id::TEXT;
            workflow_id := current_record.id::TEXT;
            workflow_user_id := current_record.user_id;
        ELSIF TG_TABLE_NAME = 'jobs' THEN
            entity_id  := current_record.id::TEXT;
            workflow_id := current_record.workflow_id::TEXT;
            SELECT user_id INTO workflow_user_id FROM workflows WHERE id = current_record.workflow_id;
        END IF;

        -- 2. Build Payload
        payload := jsonb_build_object(
            'table', TG_TABLE_NAME,
            'operation', TG_OP,
            'id', entity_id,
            'workflow_id', workflow_id,
            'timestamp', EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)
        );

        IF TG_OP = 'UPDATE' OR TG_OP = 'INSERT' THEN
            payload := payload || jsonb_build_object('new_status', NEW.status);
        END IF;

        -- 3. Notify user-specific channel
        IF workflow_user_id IS NOT NULL THEN
            PERFORM pg_notify('user_' || workflow_user_id::TEXT || '_events', payload::TEXT);
        ELSE
            -- Fallback to global_events for unassigned workflows
            PERFORM pg_notify('global_events', payload::TEXT);
        END IF;

        RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;

    -- Create triggers
    CREATE TRIGGER workflows_notify_trigger
        AFTER INSERT OR UPDATE OR DELETE ON workflows
        FOR EACH ROW EXECUTE FUNCTION notify_table_changes();

    CREATE TRIGGER jobs_notify_trigger
        AFTER INSERT OR UPDATE OR DELETE ON jobs
        FOR EACH ROW EXECUTE FUNCTION notify_table_changes();
    """)


def downgrade() -> None:
    """Downgrade schema."""
    # Drop triggers and function
    op.execute("""
    DROP TRIGGER IF EXISTS jobs_notify_trigger ON jobs;
    DROP TRIGGER IF EXISTS workflows_notify_trigger ON workflows;
    DROP FUNCTION IF EXISTS notify_table_changes();
    """)

    op.drop_index(op.f("ix_user_tokens_token"), table_name="user_tokens")
    op.drop_table("user_tokens")
    op.drop_table("files")
    op.drop_table("jobs")
    op.drop_table("errors")
    op.drop_table("rules")
    op.drop_table("workflows")
    op.drop_index(op.f("ix_user_email"), table_name="user")
    op.drop_table("user")
