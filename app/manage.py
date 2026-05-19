import argparse
import asyncio
import os
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.core.session import AsyncSessionLocal, get_async_session
from app.core.users import UserManager, get_user_db
from app.models.catalog import Catalog
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate
from app.services.catalog.backfill import (
    backfill_catalogs_from_disk_root,
    backfill_snake_template_from_path,
)


async def reset_password(email: str, new_password: str):
    async for session in get_async_session():
        async for user_db in get_user_db(session):
            user_manager = UserManager(user_db)
            user = await user_manager.get_by_email(email)
            if not user:
                print(f"Error: User with email '{email}' not found.")
                return

            # Update password using user_manager.update
            # We need to pass a UserUpdate schema
            user_update = UserUpdate(password=new_password)
            await user_manager.update(user_update, user, safe=False)
            print(f"Successfully updated password for {email}")
            return


async def catalog_backfill(root: str) -> None:
    async with AsyncSessionLocal() as session:
        summary = await backfill_catalogs_from_disk_root(session, Path(root))
        await session.commit()
        print(summary)


async def template_backfill(root: str, *, force: bool) -> None:
    async with AsyncSessionLocal() as session:
        summary = await backfill_snake_template_from_path(
            session, Path(root), force=force
        )
        await session.commit()
        print(summary)


async def create_admin(email: str, password: str, *, quiet: bool = False):
    async for session in get_async_session():
        async for user_db in get_user_db(session):
            user_manager = UserManager(user_db)
            user_create = UserCreate(
                email=email, password=password, is_superuser=True, is_active=True
            )
            hashed_password = user_manager.password_helper.hash(password)
            user_dict = user_create.model_dump()
            user_dict["hashed_password"] = hashed_password
            del user_dict["password"]

            # Remove invitation_code as it's not a database field
            if "invitation_code" in user_dict:
                del user_dict["invitation_code"]

            # FastAPI-users models usually have these fields
            await user_db.create(user_dict)
            if not quiet:
                print(f"Successfully created admin user: {email}")
            return


async def set_user_role(email: str, role: str) -> None:
    allowed = {"viewer", "user", "admin"}
    if role not in allowed:
        print(f"Error: role must be one of: {', '.join(sorted(allowed))}")
        return

    async with AsyncSessionLocal() as session:
        user = await session.scalar(select(User).where(User.email == email))
        if user is None:
            print(f"Error: User with email '{email}' not found.")
            return
        user.role = role
        if role == "admin":
            user.is_superuser = True
        elif role == "viewer":
            user.is_superuser = False
        await session.commit()
        print(f"Successfully set role for {email}: {role}")


async def catalog_set_public(slug: str, is_public: bool) -> None:
    async with AsyncSessionLocal() as session:
        catalogs = (
            (await session.execute(select(Catalog).where(Catalog.slug == slug)))
            .scalars()
            .all()
        )
        if not catalogs:
            print(f"Error: Catalog with slug '{slug}' not found.")
            return
        for catalog in catalogs:
            catalog.is_public = is_public
        await session.commit()
        state = "public" if is_public else "private"
        print(f"Successfully marked {len(catalogs)} catalog(s) named {slug}: {state}")


async def bootstrap_admin_from_env() -> None:
    """If env vars are set and there is no superuser yet, create one.

    Intended for first-time Docker deployments so operators do not need to run
    ``docker compose exec … create-admin`` manually. Remove or unset the
    variables after bootstrap; do not commit real passwords to git.
    """
    email = (os.environ.get("FLOWO_BOOTSTRAP_ADMIN_EMAIL") or "").strip()
    password = os.environ.get("FLOWO_BOOTSTRAP_ADMIN_PASSWORD") or ""
    if not email or not password:
        return

    async with AsyncSessionLocal() as session:
        super_count = await session.scalar(
            select(func.count()).select_from(User).where(User.is_superuser.is_(True))
        )
        if super_count and super_count > 0:
            print(
                "FLOWO bootstrap admin: skipped (at least one superuser already exists)."
            )
            return

        existing = await session.scalar(select(User).where(User.email == email))
        if existing is not None:
            print(
                f"FLOWO bootstrap admin: skipped (user {email!r} already exists). "
                "Use create-admin for another account or reset-password."
            )
            return

    try:
        await create_admin(email, password, quiet=True)
        print(
            "FLOWO bootstrap admin: created superuser. "
            "Unset FLOWO_BOOTSTRAP_ADMIN_EMAIL and FLOWO_BOOTSTRAP_ADMIN_PASSWORD "
            "after first deploy; do not keep bootstrap passwords in .env long term."
        )
    except IntegrityError:
        print(
            "FLOWO bootstrap admin: skipped (race: user was created concurrently). "
            "If you still have no superuser, run: python -m app.manage create-admin …"
        )


def main():
    parser = argparse.ArgumentParser(description="FlowO Management CLI")
    subparsers = parser.add_subparsers(dest="command")

    # Reset Password command
    reset_parser = subparsers.add_parser(
        "reset-password", help="Reset a user's password"
    )
    reset_parser.add_argument("email", help="User's email address")
    reset_parser.add_argument("password", help="New password")

    # Create Admin command
    admin_parser = subparsers.add_parser("create-admin", help="Create a superuser")
    admin_parser.add_argument("email", help="Admin's email address")
    admin_parser.add_argument("password", help="Admin's password")

    role_parser = subparsers.add_parser(
        "user-set-role",
        help="Set a user's role: viewer, user, or admin",
    )
    role_parser.add_argument("--email", required=True, help="User email address")
    role_parser.add_argument(
        "--role",
        required=True,
        choices=["viewer", "user", "admin"],
        help="Business role for the user",
    )

    public_parser = subparsers.add_parser(
        "catalog-set-public",
        help="Mark all catalogs with a slug as public or private",
    )
    public_parser.add_argument("--slug", required=True, help="Catalog slug")
    public_parser.add_argument(
        "--public",
        required=True,
        choices=["true", "false"],
        help="Whether the catalog should be public",
    )

    subparsers.add_parser(
        "bootstrap-admin-from-env",
        help=(
            "Create superuser from FLOWO_BOOTSTRAP_ADMIN_EMAIL and "
            "FLOWO_BOOTSTRAP_ADMIN_PASSWORD when no superuser exists yet"
        ),
    )

    bf = subparsers.add_parser(
        "catalog-backfill",
        help="Import catalog files from a legacy on-disk catalog root into the DB",
    )
    bf.add_argument(
        "--root",
        required=True,
        help="Path to the historical catalog directory (same layout as CATALOG_DIR)",
    )

    tf = subparsers.add_parser(
        "template-backfill",
        help="Import Snakemake official template files from disk into snake_template_files",
    )
    tf.add_argument(
        "--root",
        required=True,
        help="Path to a snakemake-workflow-template checkout (with workflow/)",
    )
    tf.add_argument(
        "--force",
        action="store_true",
        help="Replace existing template rows in the database",
    )

    args = parser.parse_args()

    if args.command == "reset-password":
        asyncio.run(reset_password(args.email, args.password))
    elif args.command == "create-admin":
        asyncio.run(create_admin(args.email, args.password))
    elif args.command == "user-set-role":
        asyncio.run(set_user_role(args.email, args.role))
    elif args.command == "catalog-set-public":
        asyncio.run(catalog_set_public(args.slug, args.public == "true"))
    elif args.command == "bootstrap-admin-from-env":
        asyncio.run(bootstrap_admin_from_env())
    elif args.command == "catalog-backfill":
        asyncio.run(catalog_backfill(args.root))
    elif args.command == "template-backfill":
        asyncio.run(template_backfill(args.root, force=args.force))
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
