from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .enums import FileType

if TYPE_CHECKING:
    from .job import Job


class File(Base):
    __tablename__ = "files"
    id: Mapped[int] = mapped_column(primary_key=True)
    path: Mapped[str]  # TODO: use pathlib.Path/os.pathlike type here eventually
    file_type: Mapped[FileType] = mapped_column(Enum(FileType))
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"))
    job: Mapped["Job"] = relationship("Job", back_populates="files")
