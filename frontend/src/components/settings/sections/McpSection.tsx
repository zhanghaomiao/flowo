import React, { useMemo, useState } from 'react';

import { App, Input, Segmented, Typography } from 'antd';
import {
  Bot,
  Code2,
  Copy,
  Globe2,
  Library,
  LucideIcon,
  PlayCircle,
  Plug2,
  Search,
  Terminal,
  Wrench,
} from 'lucide-react';

import { copyTextToClipboard } from '@/utils/clipboard';

import { SectionHeader } from '../shared/SectionHeader';
import { SettingsCard } from '../shared/SettingsCard';

type ClientKey = 'claude' | 'codex' | 'gemini' | 'opencode' | 'cursor';

type McpToolItem = {
  /** MCP operation id (matches backend; shown for copy/debug). */
  name: string;
  /** Human-readable name in the UI (runs vs catalog workflows). */
  label: string;
  description: string;
};

type McpToolGroup = {
  id: string;
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  tools: McpToolItem[];
};

/** Mirrors `include_operations` in app/main.py — keep in sync when MCP tools change. */
const MCP_TOOL_GROUPS: McpToolGroup[] = [
  {
    id: 'runs',
    title: 'Runs',
    subtitle:
      'Snakemake execution records. Operation ids use "run" wording; REST paths still use /workflows/... and workflow_id.',
    icon: PlayCircle,
    tools: [
      {
        name: 'list_runs',
        label: 'List runs',
        description:
          'Search runs by status, name, catalog workflow, tag, or time window.',
      },
      {
        name: 'get_latest_run',
        label: 'Get latest run',
        description:
          'Resolve the most recent run when you have filters but no run id yet.',
      },
      {
        name: 'list_running_runs',
        label: 'List running runs',
        description: 'Runs in progress with progress-oriented context.',
      },
      {
        name: 'list_recent_failed_runs',
        label: 'List recent failed runs',
        description: 'Recent failed runs and their latest errors.',
      },
      {
        name: 'summarize_run',
        label: 'Summarize run',
        description:
          'Status, jobs, rules, errors, and file signals for one run id.',
      },
      {
        name: 'summarize_latest_run',
        label: 'Summarize latest run',
        description: 'Summarize the latest run matching natural filters.',
      },
      {
        name: 'get_run_timeline',
        label: 'Run timeline',
        description: 'Job timeline and slowest steps for one run.',
      },
      {
        name: 'diagnose_run_failure',
        label: 'Diagnose run failure',
        description: 'Failed jobs, logs, and errors for one run id.',
      },
      {
        name: 'diagnose_latest_failed_run',
        label: 'Diagnose latest failed run',
        description:
          'Latest failed run using name, catalog workflow, or tag filters.',
      },
      {
        name: 'list_run_outputs',
        label: 'List run outputs',
        description:
          'Outputs for one run (optional suffix such as bam or vcf).',
      },
      {
        name: 'trace_run_output',
        label: 'Trace run output',
        description:
          'Trace one output path back to rule, job, inputs, and command.',
      },
    ],
  },
  {
    id: 'catalog',
    title: 'Catalog',
    subtitle:
      'Workflows stored in the Flowo catalog (template, Git import, or upload). Operation ids use "catalog_workflow" where relevant.',
    icon: Library,
    tools: [
      {
        name: 'list_catalog_workflows',
        label: 'List workflows',
        description:
          'Catalog workflows you can access—filter by name, description, or tags.',
      },
      {
        name: 'get_catalog_workflow_overview',
        label: 'Workflow overview',
        description:
          'Metadata, file tree, and workspace state for one catalog workflow.',
      },
      {
        name: 'read_catalog_workflow_file',
        label: 'Read workflow file',
        description:
          'Read one text file from the stored workflow in the catalog.',
      },
      {
        name: 'search_catalog_workflow_files',
        label: 'Search workflow files',
        description: 'Search paths and content inside one catalog workflow.',
      },
      {
        name: 'summarize_catalog_workflow',
        label: 'Summarize workflow',
        description:
          'Structured summary of one catalog workflow without an external LLM.',
      },
      {
        name: 'list_runs_for_catalog_workflow',
        label: 'List runs for a workflow',
        description: 'Runs that were executed from a given catalog workflow.',
      },
      {
        name: 'materialize_catalog_workflow_workspace',
        label: 'Materialize workflow workspace',
        description:
          'Rebuild the on-disk Snakemake workspace from stored files (does not change DB rows).',
      },
    ],
  },
];

export const McpSection: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const [selectedClient, setSelectedClient] = useState<ClientKey>('claude');
  const [toolQuery, setToolQuery] = useState('');

  const mcpBaseUrl = useMemo(() => `${window.location.origin}/mcp`, []);

  const filteredGroups = useMemo(() => {
    const q = toolQuery.trim().toLowerCase();
    if (!q) return MCP_TOOL_GROUPS;

    return MCP_TOOL_GROUPS.map((group) => ({
      ...group,
      tools: group.tools.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.label.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          group.title.toLowerCase().includes(q) ||
          (group.subtitle?.toLowerCase().includes(q) ?? false),
      ),
    })).filter((g) => g.tools.length > 0);
  }, [toolQuery]);

  const clientConfigs = useMemo(
    () => [
      {
        key: 'claude' as const,
        label: 'Claude',
        icon: Bot,
        target: 'claude_desktop_config.json',
        snippet: JSON.stringify(
          {
            mcpServers: {
              flowo: {
                command: 'npx',
                args: [
                  '-y',
                  'mcp-remote',
                  mcpBaseUrl,
                  '--header',
                  'Authorization: Bearer <YOUR_FLOWO_API_TOKEN>',
                ],
              },
            },
          },
          null,
          2,
        ),
      },
      {
        key: 'codex' as const,
        label: 'Codex',
        icon: Terminal,
        target: '~/.codex/config.toml',
        snippet: [
          '[mcp_servers.flowo]',
          `url = "${mcpBaseUrl}"`,
          'http_headers = { Authorization = "Bearer <YOUR_FLOWO_API_TOKEN>" }',
          '',
          '# If you prefer safer config, use bearer_token_env_var instead.',
        ].join('\n'),
      },
      {
        key: 'gemini' as const,
        label: 'Gemini CLI',
        icon: Terminal,
        target: '~/.gemini/settings.json',
        snippet: JSON.stringify(
          {
            mcpServers: {
              flowo: {
                httpUrl: mcpBaseUrl,
                headers: {
                  Authorization: 'Bearer <YOUR_FLOWO_API_TOKEN>',
                },
                trust: false,
              },
            },
          },
          null,
          2,
        ),
      },
      {
        key: 'opencode' as const,
        label: 'OpenCode',
        icon: Globe2,
        target: 'opencode.json',
        snippet: JSON.stringify(
          {
            $schema: 'https://opencode.ai/config.json',
            mcp: {
              flowo: {
                type: 'remote',
                url: mcpBaseUrl,
                enabled: true,
                headers: {
                  Authorization: 'Bearer <YOUR_FLOWO_API_TOKEN>',
                },
              },
            },
          },
          null,
          2,
        ),
      },
      {
        key: 'cursor' as const,
        label: 'Cursor',
        icon: Code2,
        target: 'Cursor Settings / mcp.json',
        snippet: JSON.stringify(
          {
            mcpServers: {
              flowo: {
                url: mcpBaseUrl,
                headers: {
                  Authorization: 'Bearer <YOUR_FLOWO_API_TOKEN>',
                },
              },
            },
          },
          null,
          2,
        ),
      },
    ],
    [mcpBaseUrl],
  );

  const selectedConfig =
    clientConfigs.find((client) => client.key === selectedClient) ??
    clientConfigs[0];

  const segmentedOptions = clientConfigs.map((client) => {
    const Icon = client.icon;

    return {
      label: (
        <span className="inline-flex items-center gap-1.5">
          <Icon size={14} />
          {client.label}
        </span>
      ),
      value: client.key,
    };
  });

  const CopyableBlock = ({ label, text }: { label: string; text: string }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          {label}
        </span>
        <button
          type="button"
          onClick={() => {
            void (async () => {
              const ok = await copyTextToClipboard(text);
              if (ok) messageApi.success('Copied');
              else messageApi.error('Could not copy');
            })();
          }}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 hover:text-sky-700"
        >
          <Copy size={14} />
          Copy
        </button>
      </div>
      <pre className="bg-slate-950 text-slate-100 p-4 rounded-xl text-sm font-mono overflow-x-auto border border-slate-800 leading-relaxed shadow-inner">
        {text}
      </pre>
    </div>
  );

  const clientIcon = selectedConfig.icon;
  const SelectedClientIcon = clientIcon;

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Plug2}
        title="MCP"
        subtitle="Tools and client configuration"
      />

      <SettingsCard>
        <div className="space-y-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-lg font-black text-slate-900 m-0">
                Client config
              </h3>
              <p className="text-sm text-slate-500 mt-1 mb-0">
                Choose a client and copy the snippet.
              </p>
            </div>
            <Segmented
              value={selectedClient}
              options={segmentedOptions}
              onChange={(value) => setSelectedClient(value as ClientKey)}
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                  <SelectedClientIcon size={18} className="text-slate-800" />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900 m-0">
                    {selectedConfig.label}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 mb-0">
                    {selectedConfig.target}
                  </p>
                </div>
              </div>
              <Typography.Text code className="text-xs whitespace-nowrap">
                {selectedConfig.target}
              </Typography.Text>
            </div>
          </div>

          <CopyableBlock
            label={selectedConfig.target}
            text={selectedConfig.snippet}
          />
        </div>
      </SettingsCard>

      <SettingsCard>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Base URL
              </span>
              <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm text-slate-900 break-all">
                {mcpBaseUrl}
              </div>
            </div>
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Auth
              </span>
              <p className="text-sm text-slate-600 mt-2 mb-0">
                Use a Flowo API token in{' '}
                <Typography.Text code className="text-xs">
                  Authorization: Bearer &lt;YOUR_FLOWO_API_TOKEN&gt;
                </Typography.Text>
                .
              </p>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-center gap-2">
                <Wrench size={16} className="text-sky-600 shrink-0" />
                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Available tools
                  </span>
                  <p className="text-sm text-slate-600 m-0 mt-0.5">
                    Shown name is for humans; the code id is what the MCP client
                    calls at{' '}
                    <Typography.Text code className="text-xs">
                      /mcp
                    </Typography.Text>
                    .
                  </p>
                </div>
              </div>
              <Input
                allowClear
                placeholder="Filter by name or description…"
                prefix={<Search size={14} className="text-slate-400" />}
                value={toolQuery}
                onChange={(e) => setToolQuery(e.target.value)}
                className="max-w-full sm:max-w-xs"
              />
            </div>

            {filteredGroups.length === 0 ? (
              <p className="text-sm text-slate-500 m-0 py-6 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50">
                No tools match that filter.
              </p>
            ) : (
              <div className="space-y-4">
                {filteredGroups.map((group) => {
                  const GroupIcon = group.icon;
                  return (
                    <div
                      key={group.id}
                      className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm"
                    >
                      <div className="flex items-start gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white border border-slate-200 text-sky-700">
                          <GroupIcon size={16} aria-hidden />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-bold text-slate-900 m-0">
                            {group.title}
                          </h4>
                          {group.subtitle ? (
                            <p className="text-xs text-slate-500 m-0 mt-1 leading-relaxed">
                              {group.subtitle}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <ul className="divide-y divide-slate-100 m-0 p-0 list-none">
                        {group.tools.map((tool) => (
                          <li
                            key={tool.name}
                            className="px-4 py-3.5 hover:bg-slate-50/60 transition-colors"
                          >
                            <div className="flex flex-col gap-1.5 min-w-0">
                              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                <span className="text-sm font-bold text-slate-900">
                                  {tool.label}
                                </span>
                                <Typography.Text
                                  code
                                  className="text-[11px] text-slate-500"
                                >
                                  {tool.name}
                                </Typography.Text>
                              </div>
                              <p className="text-sm text-slate-600 m-0 leading-relaxed">
                                {tool.description}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </SettingsCard>
    </div>
  );
};
