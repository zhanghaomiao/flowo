# Flowo Repository Guide

## 这份文件的目的

这不是产品白皮书，而是给 Codex、AI 代理和新协作者使用的仓库导航。

目标：

- 让代理快速理解项目边界和真实入口
- 回答问题时优先打开正确文件，而不是在仓库里盲搜
- 明确哪些文件是事实来源，哪些只是辅助文档

## 一句话说明项目

Flowo 是一个面向 Snakemake 的工作流观测与管理平台：

- Snakemake 侧通过 `flowo` logger 插件上报 workflow、job、rule 事件
- FastAPI 后端将事件写入 PostgreSQL
- PostgreSQL `LISTEN/NOTIFY` 配合 SSE 把实时变化推送给前端
- React 前端提供 dashboard、workflow 详情、结果预览、catalog/template 管理

## 首次进入仓库时先读这些

推荐按下面顺序阅读：

1. `README.md`
   用来理解产品定位、安装方式、基本使用方式
2. `pyproject.toml`
   用来确认 Python 包名、Snakemake entrypoint、CLI entrypoint、server 依赖
3. `frontend/package.json`
   用来确认前端技术栈、构建脚本、OpenAPI client 生成脚本
4. `app/main.py`
   FastAPI 入口；确认路由挂载和 PostgreSQL listener 生命周期
5. `app/api/__init__.py`
   查看后端功能面总表
6. `app/plugin/client/log_handler.py`
   看 Snakemake 事件如何进入系统
7. `frontend/src/routes/`
   看用户能访问哪些页面

## 仓库结构

### 根目录

- `README.md`: 对外介绍与快速开始
- `pyproject.toml`: Python 包定义；`flowo` CLI 和 Snakemake logger entrypoint
- `frontend/package.json`: 前端依赖与脚本
- `compose.yml`: 推荐的单容器部署
- `compose.multiple.yml`: 可选的多容器部署
- `compose.dev.yml`: 开发环境
- `env.example`: 主要环境变量模板
- `tests/`: pytest 测试

### 后端 `app/`

- `app/main.py`: FastAPI 应用入口
- `app/api/`: HTTP API 路由层
- `app/core/`: 配置、数据库 session、认证依赖、PostgreSQL listener
- `app/services/`: 业务逻辑核心；回答“系统实际怎么工作”时优先看这里
- `app/models/`: SQLAlchemy ORM 模型
- `app/schemas/`: Pydantic schema
- `app/plugin/`: Snakemake logger 插件和 CLI
- `app/alembic/`: 数据库迁移
- `app/utils/`: 共用工具

### 前端 `frontend/src/`

- `routes/`: TanStack Router 路由定义，先看这个理解页面结构
- `components/`: 页面和业务组件
- `client/`: 由 OpenAPI 生成的 TS client 和 React Query hooks
- `hooks/`: 复用逻辑
- `config/`: 实时更新等前端配置
- `lib/`, `utils/`: 通用工具

## 关键实现入口

### 1. Snakemake 数据怎么进来

优先阅读：

- `app/plugin/client/log_handler.py`
- `app/plugin/client/parsers.py`
- `app/api/endpoints/reports.py`

理解重点：

- Snakemake logger 捕获 `workflow_started`、`job_started`、`job_finished`、`job_error`、`rulegraph` 等事件
- 插件通过 HTTP POST 把事件发到后端 `/api/v1/reports/`
- 插件维护一个 `context`，里面有 `current_workflow_id`、tags、catalog slug、logfile、workdir 等上下文
- logger `close()` 会向后端补发 workflow close

### 2. 后端主链路

优先阅读：

- `app/main.py`
- `app/api/__init__.py`
- `app/api/endpoints/workflows.py`
- `app/api/endpoints/jobs.py`
- `app/api/endpoints/summary.py`
- `app/api/endpoints/catalog.py`
- `app/api/endpoints/sse.py`

理解重点：

- API 基础路径为 `/api/v1`
- 认证主要由 `fastapi-users` 和 token/JWT 组成
- workflow/job 读接口面向前端监控页
- summary 提供 dashboard 聚合统计和系统健康
- catalog 提供 workflow 模板与文件管理
- SSE 用 ticket 鉴权，再订阅 PostgreSQL listener 事件流

### 3. 业务逻辑放在哪

优先阅读：

- `app/services/workflow.py`
- `app/services/job.py`
- `app/services/summary.py`
- `app/services/catalog/`
- `app/services/third_party/`

规则：

- 想知道某个 API 真正返回什么、怎么算的，不要只看 endpoint，优先追到 `services/`
- `services/third_party/` 包含和 git、snakemake、snakevision 等外部能力的整合

### 4. 前端页面主链路

优先阅读：

- `frontend/src/routes/_authenticated.dashboard.tsx`
- `frontend/src/components/dashboard/DashboardLayout.tsx`
- `frontend/src/routes/_authenticated.workflow/$workflowId.tsx`
- `frontend/src/routes/_authenticated.catalog/$catalogId.tsx`
- `frontend/src/routes/_authenticated.catalog/template.tsx`

理解重点：

- Dashboard: workflow/job 状态、规则活跃度、错误分布、资源占用、系统健康
- Workflow detail: DAG、jobs、timeline、Snakefile 或 rule code、结果预览
- Catalog: workflow 模板浏览、编辑、下载、上传、DAG 预览
- 前端尽量通过 `frontend/src/client/` 中自动生成的 hooks 调后端

## 目录职责映射

当你在查这类问题时，先看这些文件：

- 认证、注册、登录、token：
  `app/api/endpoints/auth.py`, `app/api/endpoints/tokens.py`, `app/core/users.py`
- workflow 列表、详情、进度、rule graph、timeline：
  `app/api/endpoints/workflows.py`, `app/services/workflow.py`
- job 列表和 job 级信息：
  `app/api/endpoints/jobs.py`, `app/services/job.py`
- dashboard 统计、系统资源、健康检查：
  `app/api/endpoints/summary.py`, `app/services/summary.py`, `frontend/src/components/dashboard/`
- 实时更新、事件推送、SSE：
  `app/api/endpoints/sse.py`, `app/core/pg_listener.py`, `frontend/src/config/`
- catalog/template 文件浏览、编辑、下载、上传：
  `app/api/endpoints/catalog.py`, `app/services/catalog/`, `frontend/src/components/catalog/`
- Snakemake 官方模板同步与 DAG：
  `app/services/catalog/snake_template.py`, `app/services/third_party/snakevision.py`
- 输出文件预览：
  `app/api/endpoints/outputs.py`, `app/api/endpoints/files.py`, `frontend/src/components/features/`
- 邮件通知、系统设置：
  `app/services/notification.py`, `app/api/endpoints/settings.py`, `app/models/system_settings.py`
- 管理员能力：
  `app/api/endpoints/admin.py`

## 数据流总览

默认把系统理解成这条链：

1. Snakemake 执行 workflow
2. `flowo` logger 收集事件与上下文
3. 插件将事件 POST 到后端 `reports` 接口
4. 后端写入 PostgreSQL 中的 workflow、rule、job、error 等表
5. 数据库事件通过 `LISTEN/NOTIFY` 进入 `pg_listener`
6. SSE 将事件流推给前端
7. 前端收到事件后使 React Query 缓存失效并刷新局部数据

## 数据模型速览

最关键的表：

- `user`: 用户
- `workflows`: workflow 元数据和整体状态
- `rules`: 规则定义与代码片段
- `jobs`: 单个任务执行记录
- `errors`: workflow 或 job 错误
- `files`: 输出文件或关联文件
- `user_tokens`: API token
- `catalogs`: workflow 模板目录
- `catalog_files`: 当前文件内容
- `catalog_file_versions`: 历史版本
- `system_settings`, `user_settings`: 系统与用户配置

关系上最重要的是：

- 一个 `workflow` 下面有多个 `rules`、`jobs`、`errors`
- 一个 `catalog` 可以关联多个 workflow
- catalog 文件内容以数据库为主，文件系统更像导出缓存

## Catalog 相关特别说明

这是本仓库最容易被误解的部分：

- `catalog` 不只是静态文件目录，而是产品能力的一部分
- 文件内容以数据库表为事实来源，不应默认把磁盘文件当成唯一真相
- Snakemake 官方 `workflow template` 和用户 catalog 是两套东西
- 官方模板路径由 `SNAKEMAKE_WORKFLOW_TEMPLATE_DIR` 控制（持久化挂载下的缓存目录，不进镜像层）
- 服务启动时会**尽力**做一次 `ensure`：若目录不存在或缺少 `workflow/`，则与 UI「Pull / update」相同逻辑，浅克隆或 `git pull --ff-only`；若已是完整 checkout，**不会**在每次重启时自动 pull，避免意外改动本地模板。克隆失败不阻塞启动，日志 warning，前端 `catalog/template` 可显示 `ready=false`，用户可再点 Pull 或离线放入模板目录
- **在线部署**：装好 `git`、能访问 GitHub 时，一般无需手动 pull 即可在首次启动后使用模板页 / 从模板新建
- **离线部署**：事先把官方仓库内容放到容器内对应路径（默认与 `FLOWO_WORKING_PATH` 挂载一致时，例如宿主机 `${FLOWO_WORKING_PATH}/snakemake-workflow-template` → 容器内 `${CONTAINER_MOUNT_PATH}/snakemake-workflow-template`），保证存在 `workflow/` 目录即可；无需 GitHub
- CLI 中 `flowo catalog pull`、`flowo catalog upload`、`flowo catalog new` 是真实用户工作流的一部分；`flowo catalog new` 仍可在本机按需 clone，与服务端模板目录互不强制依赖

## 前端约定

- 使用 React 19、TypeScript、Vite
- 路由在 `frontend/src/routes/`
- API client 通过 `openapi-ts` 生成到 `frontend/src/client/`
- 优先复用生成的 React Query hooks，不要手写重复 fetch 逻辑
- 页面问题先看 route，再跳到对应 component

## 后端约定

- FastAPI 路由尽量保持薄，业务逻辑放 `services/`
- 需要理解返回值结构时，同时看 endpoint、schema、service
- 需要理解权限时，看 endpoint 里的 `Depends(...)` 和 `app/core/users.py`
- 需要理解实时事件时，看 `app/core/pg_listener.py` 和 `sse.py`

## 本仓库的事实来源

回答问题时，优先把下面文件视为事实来源：

- 入口和路由：
  `app/main.py`, `app/api/__init__.py`, `frontend/src/routes/`
- 包与脚本定义：
  `pyproject.toml`, `frontend/package.json`
- 真实业务逻辑：
  `app/services/`
- 真实数据结构：
  `app/models/`, `app/schemas/`

下面这些更适合作为辅助信息，而不是最终事实来源：

- `README.md`
- `docs/`
- 历史截图
- `dist/`, `site/`

## 可先忽略的目录

如果问题和它们无关，默认不要优先读：

- `.git/`
- `.nox/`
- `.pytest_cache/`
- `.mypy_cache/`
- `.ruff_cache/`
- `dist/`
- `site/`
- `__pycache__/`

## 常用命令

### Python

```bash
uv sync
nox -s tests
pytest tests/
ruff check .
black .
```

### 前端

```bash
cd frontend
npm install
npm run dev
npm run build
npm run generate-client
```

### 开发部署

```bash
docker compose -f compose.dev.yml up --build
```

## 给 Codex/AI 的工作建议

- 先判断问题属于 plugin、backend、frontend、catalog、infra 哪一层
- 先看 route 或 CLI 入口，再看 service，再看 model 和 schema
- 不要把 README 文案当成实现真相
- 遇到 catalog 相关逻辑时，优先确认数据来自数据库还是磁盘导出
- 遇到实时问题时，优先沿着 `SSE -> pg_listener -> NOTIFY/LISTEN` 追
- 遇到 workflow 展示问题时，优先沿着 `route -> generated client hook -> endpoint -> service` 追

## 当前匹配性结论

旧版 `AGENTS.md` 与仓库方向基本匹配，但更像项目说明书，不够像 AI 导航，主要问题是：

- 太偏产品介绍，缺少“先看什么”
- 缺少问题到文件映射
- 缺少事实来源优先级
- 没明确哪些目录可忽略
- 没体现当前前端真实路由结构和 dashboard、workflow、catalog 入口

本文件已经按“让 Codex/AI 秒懂架构”的目标重写，后续建议优先维护这里，而不是继续堆长篇背景介绍。
