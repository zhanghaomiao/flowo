from enum import Enum


class EventName(str, Enum):
    WORKFLOW_STARTED = "workflow_started"
    RUN_INFO = "run_info"
    JOB_INFO = "job_info"
    JOB_STARTED = "job_started"
    JOB_FINISHED = "job_finished"
    JOB_ERROR = "job_error"
    RULEGRAPH = "rulegraph"
    GROUP_INFO = "group_info"
    GROUP_ERROR = "group_error"
    ERROR = "error"
    CLOSE = "close"
