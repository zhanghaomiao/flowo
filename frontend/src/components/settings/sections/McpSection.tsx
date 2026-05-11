import React, { useMemo, useState } from 'react';

import { App, Segmented, Typography } from 'antd';
import {
  Bot,
  Code2,
  Copy,
  Globe2,
  Plug2,
  Terminal,
  Wrench,
} from 'lucide-react';

import { copyTextToClipboard } from '@/utils/clipboard';

import { SectionHeader } from '../shared/SectionHeader';
import { SettingsCard } from '../shared/SettingsCard';

type ClientKey = 'claude' | 'codex' | 'gemini' | 'opencode' | 'cursor';

const MCP_TOOL_GROUPS = [
  {
    title: 'Find',
    tools: [
      'list_workflows',
      'get_latest_workflow',
      'list_running_workflows',
      'list_recent_failed_workflows',
    ],
  },
  {
    title: 'Inspect',
    tools: [
      'summarize_workflow',
      'summarize_latest_workflow',
      'get_workflow_timeline',
    ],
  },
  {
    title: 'Diagnose',
    tools: ['diagnose_workflow_failure', 'diagnose_latest_failed_workflow'],
  },
  {
    title: 'Outputs',
    tools: ['list_workflow_outputs', 'trace_output'],
  },
] as const;

export const McpSection: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const [selectedClient, setSelectedClient] = useState<ClientKey>('claude');

  const mcpBaseUrl = useMemo(() => `${window.location.origin}/mcp`, []);

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

          <div className="border-t border-slate-100 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Wrench size={16} className="text-sky-600" />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Tools
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {MCP_TOOL_GROUPS.map((group) => (
                <div key={group.title} className="space-y-2">
                  <div className="text-[11px] font-bold text-slate-500">
                    {group.title}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {group.tools.map((tool) => (
                      <Typography.Text key={tool} code className="text-xs">
                        {tool}
                      </Typography.Text>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
};
