import argparse
import asyncio
from pathlib import Path

from app.core.session import AsyncSessionLocal, get_async_session
from app.core.users import UserManager, get_user_db
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


async def create_admin(email: str, password: str):
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
            print(f"Successfully created admin user: {email}")
            return


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
    elif args.command == "catalog-backfill":
        asyncio.run(catalog_backfill(args.root))
    elif args.command == "template-backfill":
        asyncio.run(template_backfill(args.root, force=args.force))
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
