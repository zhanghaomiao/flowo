# Flowo - 项目技术栈与架构说明

## 项目概述

Flowo 是一个基于 PostgreSQL 的 Snakemake 工作流日志插件和实时监控仪表板。它提供了一个统一的解决方案来收集、存储和监控 Snakemake 工作流的执行情况。

**项目类型**: 工作流监控与管理平台  
**主要功能**: 实时监控、日志收集、任务跟踪、文件预览、权限管理

## 技术栈总览

### 后端技术栈
 ∈ **Python 3.12+**
 ∈ **FastAPI** - 现代高性能 Web 框架
 ∈ **SQLAlchemy** - ORM 数据库操作
 ∈ **AsyncPG** - 异步 PostgreSQL 驱动
 ∈ **Pydantic** - 数据验证和设置管理
 ∈ **FastAPI Users** - 用户认证和授权
 ∈ **Alembic** - 数据库迁移管理
 ∈ **SSE-Starlette** - 服务器发送事件实时通信

### 前端技术栈
 ∈ **React 19** - 前端框架
 ∈ **TypeScript** - 类型安全
 ∈ **Vite** - 构建工具
 ∈ **TanStack Router** - 路由管理
 ∈ **TanStack Query** - 数据获取和缓存
 ∈ **Ant Design** - UI 组件库
 ∈ **ECharts** - 数据可视化
 ∈ **React Flow** - 流程图可视化

### 数据库
 ∈ **PostgreSQL 15** - 主数据库
 ∈ **PostgreSQL NOTIFY/LISTEN** - 实时事件通知机制

### 基础设施
 ∈ **Docker & Docker Compose** - 容器化部署
 ∈ **Caddy** - 反向代理和网关
 ∈ **uv** - Python 包管理器
 ∈ **Nox** - 测试和开发环境管理

### 插件系统
 ∈ **Snakemake Logger Plugin Interface** - Snakemake 日志插件接口
 ∈ **httpx** - 异步 HTTP 客户端

## 项目架构

### 系统架构图
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Snakemake      │    │  Flowo Plugin   │    │  FastAPI        │
│  Workflow       │────▶│  (Logger)       │────▶│  Backend        │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────┬───────┘
                                                        │
                                                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  React          │    │  PostgreSQL     │    │  Real-time      │
│  Frontend       │◀───▶│  Database       │◀───▶│  SSE Events    │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 核心组件

#### 1. Snakemake 插件 (`app/plugin/`)
- **位置**: `app/plugin/`
- **功能**: 实现 Snakemake 日志接口，捕获工作流执行事件
- **关键文件**:
  - `app/plugin/__init__.py` - 插件入口点
  - `app/plugin/client/cli.py` - CLI 工具
  - `app/plugin/schemas.py` - 数据模式

#### 2. FastAPI 后端 (`app/`)
- **位置**: `app/`
- **功能**: REST API 服务，处理数据存储和实时通知
- **关键模块**:
  - `app/main.py` - 应用入口
  - `app/core/config.py` - 配置管理
  - `app/core/pg_listener.py` - PostgreSQL 监听器
  - `app/api/` - API 端点
  - `app/services/` - 业务逻辑服务
  - `app/models/` - 数据库模型
  - `app/schemas/` - Pydantic 模式

#### 3. 前端应用 (`frontend/`)
- **位置**: `frontend/`
- **功能**: 用户界面，实时监控仪表板
- **关键目录**:
  - `frontend/src/routes/` - 页面路由
  - `frontend/src/components/` - React 组件
  - `frontend/src/client/` - API 客户端
  - `frontend/src/hooks/` - 自定义 Hook

#### 4. 数据库模型 (`app/models/`)
- **核心表结构**:
  - `user` - 用户信息 (FastAPI Users 集成)
  - `workflows` - 工作流元数据
  - `rules` - 规则定义
  - `jobs` - 任务执行记录
  - `errors` - 错误日志
  - `files` - 文件关联
  - `user_tokens` - API 访问令牌
  - `catalogs` - 工作流模板目录
  - `catalog_files` - Catalog 文件内容 (数据库优先存储)
  - `catalog_file_versions` - 文件版本历史
  - `system_settings` - 系统设置
  - `user_settings` - 用户设置

## 数据库设计

### 核心表关系
```
user (1) ────┐
             │
             ├── (1:n) ─── workflows (1) ─── (1:n) ─── rules (1) ─── (1:n) ─── jobs
user_tokens  │                                                      │
             │                                                      ├── (1:n) ─── files
             │                                                      └── (1:n) ─── errors
             │
             ├── (1:n) ─── catalogs (1) ─── (1:n) ─── catalog_files
             │                                      │
             │                                      └── (1:n) ─── catalog_file_versions
             │
             └── (1:1) ─── user_settings
```

### Catalog 文件存储架构（数据库优先）

#### 设计原则
- **单一事实来源**: PostgreSQL 是所有文件内容的唯一来源
- **自动版本控制**: 每次文件修改自动创建版本记录
- **只读导出**: 文件系统只是数据库的导出缓存，供 Snakemake 直接读取

#### 核心表
- **catalog_files**: 存储当前最新版本的文件内容
  - `content`: 文件内容（TEXT 类型，PostgreSQL 自动 TOAST 压缩）
  - `content_sha256`: 内容哈希，用于去重和校验
  - `language`: 文件语言类型（python, snakemake, yaml 等）
  - `current_version`: 当前版本号

- **catalog_file_versions**: 完整的文件版本历史
  - `version`: 版本号（自增）
  - `content`: 历史版本内容
  - `created_by`: 修改者
  - `created_at`: 修改时间

#### 工作流程
```
1. 用户在前端编辑文件
   ↓
2. 调用 PUT /api/v1/catalog/{slug}/files/{path}
   ↓
3. 后端写入 catalog_files 表
   ↓
4. 自动创建版本记录到 catalog_file_versions
   ↓
5. 异步导出到文件系统（只读缓存）
   ↓
6. Snakemake 直接读取导出的文件运行
```

### Snakemake 官方 workflow 模板（与用户 catalog 分离）

- **目录**: 环境变量 `SNAKEMAKE_WORKFLOW_TEMPLATE_DIR`（默认 `{CONTAINER_MOUNT_PATH}/snakemake-workflow-template`），与 `CATALOG_DIR` 下各用户 slug **分开**；由 `git clone` / `git pull` 维护官方 [snakemake-workflow-template](https://github.com/snakemake-workflows/snakemake-workflow-template)。
- **API**: `GET|POST|PUT /api/v1/catalog/snake-template...`（[`app/api/endpoints/catalog.py`](app/api/endpoints/catalog.py)）；前端「Snakemake template」→ `/catalog/template`。
- **CLI**（随 `snakemake-logger-plugin-flowo` 安装，无需把整仓加入 `PYTHONPATH`）: `flowo catalog template pull`、`flowo catalog new <name> [--output DIR] [--with-git]`，与后端共用同一 `SNAKEMAKE_WORKFLOW_TEMPLATE_DIR`（可在 `~/.config/flowo/.env` 覆盖）。
- **依赖**: 运行环境需 `git`。

### 实时通知机制
- **PostgreSQL NOTIFY/LISTEN**: 通过数据库触发器实现实时事件推送
- **用户级频道**: `user_<user_id>_events` 和 `global_events`
- **SSE 集成**: 前端通过 Server-Sent Events 接收实时更新

## 开发工作流

### 1. 环境设置
```bash
# 使用 uv 管理依赖
uv sync

# 使用 nox 运行测试
nox -s tests

# 开发环境启动
docker compose -f docker-compose.dev.yml up --build
```

### 2. 数据库迁移
```bash
# 生成迁移
alembic revision --autogenerate -m "description"

# 应用迁移
alembic upgrade head
```

### 3. 代码质量
```bash
# 代码格式化
ruff check --fix
black .

# 类型检查
mypy app/

# 运行测试
pytest tests/
```

### 4. 构建和部署
```bash
# 构建 Python 包
python -m build

# 单容器部署
docker compose -f docker/compose.yml up -d

# 多容器部署
docker compose -f docker/compose.multiple.yml up -d
```

## 配置管理

### 环境变量配置
- **主配置文件**: `app/core/config.py` (基于 Pydantic Settings)
- **环境文件**: `.env` (从 `env.example` 复制)
- **用户配置**: `~/.config/flowo/.env`

### 关键配置项
```env
# 数据库配置
POSTGRES_DB=flowo_logs
POSTGRES_USER=flowo
POSTGRES_PASSWORD=flowo_password
POSTGRES_HOST=localhost
POSTGRES_PORT=5432

# 应用配置
PORT=3100
DOMAIN=localhost
PROTOCOL=http

# Flowo 特定配置
FLOWO_USER_TOKEN=your_token_here
FLOWO_HOST=http://localhost:3100
FLOWO_WORKING_PATH=/tmp/flowo_working_dir
```

## API 设计

### REST API 结构
- **基础路径**: `/api/v1`
- **认证**: Bearer Token (JWT)
- **实时更新**: SSE 端点 `/api/v1/sse`

### 主要端点
- `GET /api/v1/workflows` - 获取工作流列表
- `GET /api/v1/workflows/{id}` - 获取工作流详情
- `GET /api/v1/workflows/{id}/jobs` - 获取任务列表
- `GET /api/v1/workflows/{id}/timeline` - 获取时间线数据
- `GET /api/v1/sse` - SSE 实时事件流
- `POST /api/v1/auth/*` - 认证相关端点
- `GET /api/v1/catalog/*` - 工作流模板管理

## 前端架构

### 路由结构
- `/` - 仪表板首页
- `/workflows` - 工作流列表
- `/workflows/:id` - 工作流详情
- `/workflows/:id/jobs` - 任务列表
- `/workflows/:id/timeline` - 执行时间线
- `/catalogs` - 模板目录
- `/settings` - 用户设置
- `/profile` - 用户资料

### API 客户端自动生成

项目使用 **HeyAPI (openapi-ts)** 从后端 OpenAPI 规范自动生成完整的 TypeScript API 客户端。

#### 配置文件
```javascript
// frontend/openapi-ts.config.js
import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: 'http://localhost:3100/api/v1/openapi.json',
  output: 'src/client',
  plugins: [
    {
      baseUrl: false,
      name: '@hey-api/client-fetch',
    },
    {
      name: '@tanstack/react-query',
      queryOptions: true,
      mutationOptions: true,
      useQuery: true,
      queryKeys: {
        tags: true,
      },
    },
  ],
});
```

#### 生成命令
```bash
cd frontend
npm run generate-client
# 或
pnpm generate-client
```

#### 生成的客户端结构
```
frontend/src/client/
├── @tanstack/react-query.gen.ts  # TanStack Query hooks
├── client.gen.ts                  # 基础 fetch client
├── sdk.gen.ts                     # SDK 函数
├── types.gen.ts                   # TypeScript 类型定义
├── core/                          # 核心工具
└── index.ts                       # 入口文件
```

### TanStack Query 集成

自动生成类型安全的 React Query hooks，包括：

#### Query Hooks (GET 请求)
```typescript
// 列表查询
const { data, isLoading } = useListCatalogsQuery({
  query: { search: 'keyword' },
});

// 详情查询
const { data } = useGetCatalogQuery({
  path: { slug: 'my-workflow' },
});

// 文件列表
const { data } = useListFilesQuery({
  path: { workflowId: 'uuid' },
});
```

#### Mutation Hooks (POST/PUT/DELETE 请求)
```typescript
import { useMutation } from '@tanstack/react-query';
import {
  createCatalogMutation,
  deleteCatalogMutation,
  writeFileMutation,
} from '@/client/@tanstack/react-query.gen';

// 创建 catalog
const createMutation = useMutation(createCatalogMutation());
await createMutation.mutateAsync({
  body: { name: 'New Workflow', description: '...' },
});

// 删除 catalog
const deleteMutation = useMutation(deleteCatalogMutation());
await deleteMutation.mutateAsync({
  path: { slug: 'my-workflow' },
});

// 写文件
const writeMutation = useMutation(writeFileMutation());
await writeMutation.mutateAsync({
  path: { slug: 'my-workflow', file_path: 'Snakefile' },
  body: { content: 'rule all: ...' },
});
```

#### Query Keys 管理
自动生成类型安全的 query keys：
```typescript
import {
  listCatalogsQueryKey,
  getCatalogQueryKey,
} from '@/client/@tanstack/react-query.gen';

// 使缓存失效
queryClient.invalidateQueries({
  queryKey: listCatalogsQueryKey({}),
});

// 设置缓存数据
queryClient.setQueryData(
  getCatalogQueryKey({ path: { slug: 'my-workflow' } }),
  newData
);
```

### 状态管理
- **TanStack Query**: 服务器状态管理（数据获取、缓存、重试、乐观更新）
- **React Context**: 认证状态（用户信息、Token）
- **本地状态**: React useState/useReducer

### 实时更新
- **SSE 客户端**: 通过 EventSource 连接 `/api/v1/sse`
- **自动重连**: 连接断开时自动重试
- **消息去重**: 避免重复处理相同事件
- **自动更新**: 收到事件后自动使 TanStack Query 缓存失效

### 典型组件示例
```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createCatalogMutation,
  useListCatalogsQuery,
} from '@/client/@tanstack/react-query.gen';

const CatalogList = () => {
  const queryClient = useQueryClient();
  
  // 查询列表 - 自动处理加载、缓存、重试
  const { data: catalogs, isLoading } = useListCatalogsQuery({});
  
  // 创建 mutation
  const createMutation = useMutation(createCatalogMutation(), {
    onSuccess: () => {
      // 成功后刷新列表
      queryClient.invalidateQueries({ queryKey: listCatalogsQueryKey({}) });
    },
  });
  
  return (
    <div>
      {catalogs?.map(cat => <div key={cat.id}>{cat.name}</div>)}
    </div>
  );
};
```

## 插件系统

### Snakemake 集成
```bash
# 安装插件
pip install snakemake-logger-plugin-flowo

# 使用插件
snakemake --logger flowo \
    --logger-flowo-name=project_name \
    --logger-flowo-tags="tag1,tag2"
```

### CLI 工具
```bash
# 生成配置
flowo --generate-config --token YOUR_TOKEN

# 管理模板目录
flowo catalog pull slug
flowo catalog upload --path ./catalog
```

## 部署选项

### 1. 单容器部署 (推荐)
```bash
docker compose -f docker/compose.yml up -d
```
- 包含: PostgreSQL + Flowo (FastAPI + React + Caddy)

### 2. 多容器部署
```bash
docker compose -f docker-compose.multiple.yml up -d
```
- 分离: PostgreSQL + FastAPI + React + Caddy

### 3. 开发环境
```bash
docker compose -f docker-compose.dev.yml up --build
```
- 支持热重载和开发工具

## 测试策略

### 测试类型
1. **单元测试**: 业务逻辑和工具函数
2. **集成测试**: API 端点和数据库交互
3. **插件测试**: Snakemake 插件功能
4. **端到端测试**: 完整工作流测试

### 测试工具
- **pytest**: 主要测试框架
- **pytest-asyncio**: 异步测试支持
- **httpx**: HTTP 客户端测试
- **snakemake**: 插件集成测试

## 监控和日志

### 日志记录
- **结构化日志**: 使用 Python logging 模块
- **多级别**: DEBUG, INFO, WARNING, ERROR
- **文件输出**: 工作流执行日志

### 性能监控
- **数据库查询优化**: SQLAlchemy 性能调优
- **实时事件延迟**: SSE 连接监控
- **内存使用**: 工作流数据处理

## 安全考虑

### 认证和授权
- **JWT 令牌**: 短期访问令牌
- **API 令牌**: 长期服务令牌
- **用户隔离**: 数据访问权限控制

### 数据安全
- **HTTPS 推荐**: 生产环境必须使用 HTTPS
- **敏感数据**: 不存储密码明文
- **文件权限**: 工作目录访问控制

## 扩展和定制

### 自定义插件
1. 继承 `snakemake_interface_logger_plugins.LoggerPlugin`
2. 实现事件处理方法
3. 注册为 Snakemake 日志处理器

### API 扩展
1. 在 `app/api/endpoints/` 添加新端点
2. 在 `app/services/` 实现业务逻辑
3. 在 `app/schemas/` 定义数据模式

### 前端扩展
1. 在 `frontend/src/routes/` 添加新路由
2. 在 `frontend/src/components/` 创建新组件
3. 在 `frontend/src/client/` 添加 API 客户端

## 故障排除

### 常见问题
1. **数据库连接失败**: 检查 PostgreSQL 配置和网络
2. **SSE 连接断开**: 检查代理配置和超时设置
3. **插件配置错误**: 验证令牌和主机 URL
4. **文件权限问题**: 检查工作目录权限和 UID/GID

### 调试工具
- **后端日志**: Docker 容器日志
- **前端开发工具**: React DevTools, TanStack Query DevTools
- **数据库管理**: pgAdmin 或 psql 客户端

## 贡献指南

### 开发流程
1. Fork 项目仓库
2. 创建功能分支
3. 编写代码和测试
4. 提交 Pull Request
5. 代码审查和合并

### 代码规范
- **Python**: 遵循 PEP 8, 使用 ruff 和 black
- **TypeScript**: 使用 ESLint 和 Prettier
- **提交信息**: 使用约定式提交

### 文档要求
- **API 文档**: OpenAPI/Swagger 自动生成
- **用户文档**: MkDocs 编写的使用指南
- **代码注释**: 重要的函数和类需要文档字符串

---

*最后更新: 2025-05-07*
*项目版本: 1.2.0*
*Python 要求: >=3.12*