from .archive import CatalogArchiveMixin
from .base import CatalogBase
from .crud import CatalogCRUDMixin
from .dag import CatalogDAGMixin
from .files import CatalogFilesMixin
from .git_ops import CatalogGitMixin
from .sync_fs import CatalogFSSyncMixin


class CatalogService(
    CatalogBase,
    CatalogCRUDMixin,
    CatalogFSSyncMixin,
    CatalogFilesMixin,
    CatalogArchiveMixin,
    CatalogDAGMixin,
    CatalogGitMixin,
):
    """Service for managing Snakemake workflow catalogs."""

    pass
