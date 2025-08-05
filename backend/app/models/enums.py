from enum import Enum


class Status(Enum):
    ERROR = "ERROR"
    RUNNING = "RUNNING"
    SUCCESS = "SUCCESS"
    WAITING = "WAITING"
    UNKNOWN = "UNKNOWN"


class FileType(Enum):
    INPUT = "INPUT"
    OUTPUT = "OUTPUT"
    LOG = "LOG"
    BENCHMARK = "BENCHMARK"
