from .archive import CatalogArchiveMixin
from .base import CatalogBase
from .crud import CatalogCRUDMixin
from .dag import CatalogDAGMixin
from .files import CatalogFilesMixin
from .git_ops import CatalogGitMixin


class CatalogService(
    CatalogBase,
    CatalogCRUDMixin,
    CatalogFilesMixin,
    CatalogArchiveMixin,
    CatalogDAGMixin,
    CatalogGitMixin,
):
    """Service for managing Snakemake workflow catalogs."""

    pass
