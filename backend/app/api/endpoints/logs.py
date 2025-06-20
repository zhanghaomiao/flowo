import asyncio
from collections.abc import AsyncGenerator
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.core.logger import logger
from app.core.session import get_db
from app.models.workflow import Workflow

router = APIRouter()


@router.get("/{workflow_id}")
async def get_workflow_logs(workflow_id: str):
    session = next(get_db())
    try:
        workflow = session.query(Workflow).filter(Workflow.id == workflow_id).first()
        if not workflow:
            raise HTTPException(
                status_code=404, detail=f"Workflow {workflow_id} not found"
            )

        if (
            not workflow.logfile
            or not workflow.directory
            or not workflow.flowo_working_path
        ):
            # raise HTTPException(
            #     status_code=404,
            #     detail=f"No log file configured for workflow {workflow_id}",
            # )
            return {
                "workflow_id": workflow_id,
                "log_file": workflow.logfile,
                "exists": False,
                "content": "",
                "message": "Log file does not exist yet",
            }

        logfile = workflow.logfile.replace(workflow.flowo_working_path, "/work_dir/")

        # read the log file
        with open(logfile, encoding="utf-8") as f:
            content = f.read()

        return {
            "workflow_id": workflow_id,
            "log_file": workflow.logfile,
            "content": content,
        }
    finally:
        session.close()


@router.get("/{workflow_id}/sse")
async def stream_workflow_logs_sse(workflow_id: str):
    """使用Server-Sent Events格式的实时日志流"""

    session = next(get_db())
    try:
        workflow = session.query(Workflow).filter(Workflow.id == workflow_id).first()
        if not workflow:
            raise HTTPException(
                status_code=404, detail=f"Workflow {workflow_id} not found"
            )

        if not workflow.logfile:
            raise HTTPException(
                status_code=404,
                detail=f"No log file configured for workflow {workflow_id}",
            )

        log_file_path = Path(workflow.logfile)

        # 如果文件不存在，创建空文件
        if not log_file_path.exists():
            log_file_path.parent.mkdir(parents=True, exist_ok=True)
            log_file_path.touch()

    finally:
        session.close()

    async def sse_generator() -> AsyncGenerator[str, None]:
        """SSE格式的日志流生成器"""
        process = None
        try:
            # 启动tail -f进程
            process = await asyncio.create_subprocess_exec(
                "tail",
                "-f",
                str(log_file_path),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            logger.info(f"Started SSE tail -f for {log_file_path}")

            # 发送连接确认
            yield f"event: connected\ndata: Connected to {workflow_id}\n\n"

            # 读取输出
            while True:
                line = await process.stdout.readline()
                if not line:
                    break

                # SSE格式发送
                log_line = line.decode("utf-8", errors="ignore")
                if log_line:
                    yield f"event: logs.{workflow_id}\ndata: {log_line}\n\n"

        except Exception as e:
            logger.error(f"Error in SSE log stream: {e}")
            yield f"event: error\ndata: {str(e)}\n\n"
        finally:
            if process:
                try:
                    process.terminate()
                    await process.wait()
                    logger.info(f"Terminated SSE tail process for {log_file_path}")
                except Exception:
                    pass

    return StreamingResponse(
        sse_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "X-Accel-Buffering": "no",
        },
    )
