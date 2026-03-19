import shutil
from typing import Any

from fastapi import HTTPException

from .utils import (
    _detect_language,
    _get_catalog_dir,
    _validate_path,
)


class CatalogFilesMixin:
    async def read_file(self, slug: str, file_path: str) -> dict[str, Any]:
        """Read a file's content from a catalog."""
        full_path = _validate_path(slug, file_path)

        if not full_path.exists() or not full_path.is_file():
            raise HTTPException(status_code=404, detail="File not found")

        try:
            content = full_path.read_text(errors="replace")
        except Exception as e:
            raise HTTPException(
                status_code=500, detail=f"Error reading file: {e}"
            ) from e

        return {
            "path": file_path,
            "name": full_path.name,
            "content": content,
            "language": _detect_language(file_path),
            "lines": content.count("\n") + 1,
            "size": full_path.stat().st_size,
        }

    async def write_file(
        self,
        slug: str,
        file_path: str,
        content: str,
    ) -> dict[str, Any]:
        """Create or update a file in a catalog. Creates parent dirs on demand."""
        full_path = _validate_path(slug, file_path)

        # Ensure parent directory exists (on-demand creation)
        full_path.parent.mkdir(parents=True, exist_ok=True)

        full_path.write_text(content)

        return await self.read_file(slug, file_path)

    async def delete_file(
        self,
        slug: str,
        file_path: str,
    ) -> None:
        """Delete a file from a catalog."""
        full_path = _validate_path(slug, file_path)

        if not full_path.exists() or not full_path.is_file():
            raise HTTPException(status_code=404, detail="File not found")

        if file_path in ["workflow/Snakefile", "Snakefile"]:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete the mandatory Snakefile",
            )

        full_path.unlink()

    async def create_directory(
        self,
        slug: str,
        directory_path: str,
    ) -> dict[str, str]:
        """Create a new directory in the catalog."""
        full_path = _validate_path(slug, directory_path)
        full_path.mkdir(parents=True, exist_ok=True)
        return {"path": directory_path, "status": "created"}

    async def delete_directory(
        self,
        slug: str,
        directory_path: str,
    ) -> None:
        """Delete a directory and all its contents."""
        full_path = _validate_path(slug, directory_path)
        if not full_path.exists() or not full_path.is_dir():
            raise HTTPException(status_code=404, detail="Directory not found")

        # Security: don't allow deleting the catalog root or the mandatory workflow/ dir if it contains Snakefile
        catalog_dir = _get_catalog_dir()
        catalog_path = catalog_dir / slug
        if full_path == catalog_path.resolve():
            raise HTTPException(status_code=400, detail="Cannot delete catalog root")

        if (full_path / "Snakefile").exists() or (
            full_path / "workflow" / "Snakefile"
        ).exists():
            raise HTTPException(
                status_code=400, detail="Directory contains mandatory Snakefile"
            )

        shutil.rmtree(full_path)

    async def rename_path(
        self,
        slug: str,
        old_path: str,
        new_path: str,
    ) -> dict[str, str]:
        """Rename a file or directory in the catalog."""
        full_old_path = _validate_path(slug, old_path)
        full_new_path = _validate_path(slug, new_path)

        if not full_old_path.exists():
            raise HTTPException(status_code=404, detail="Source path not found")

        if full_new_path.exists():
            raise HTTPException(
                status_code=400, detail="Destination path already exists"
            )

        # Security check: don't allow renaming the mandatory Snakefile (case sensitive)
        if old_path in ["workflow/Snakefile", "Snakefile"]:
            raise HTTPException(
                status_code=400, detail="Cannot rename the mandatory Snakefile"
            )

        # Ensure parent directory for new path exists
        full_new_path.parent.mkdir(parents=True, exist_ok=True)

        full_old_path.rename(full_new_path)

        return {"status": "renamed", "old_path": old_path, "new_path": new_path}
