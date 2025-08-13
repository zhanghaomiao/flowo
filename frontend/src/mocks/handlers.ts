import { http, HttpResponse } from 'msw'
import {
  mockWorkflows,
  mockJobs,
  mockUsers,
  mockTags,
  mockSnakefiles,
  mockConfigFiles,
  mockLogs,
  mockRuleGraph,
  mockRuleStats,
  mockTimes
} from './data'

export const handlers = [
  // summary
  http.get('/api/v1/summary/resources', () => {
    return HttpResponse.json({
      cpu_idle_cores: 12,
      cpu_total_cores: 12,
      mem_total_GB: 31.28,
      mem_available_GB: 22.67
    })
  }),

  http.get('/api/v1/summary/user', () => {
    return HttpResponse.json({
      total: 1,
      running: 0
    })
  }),

  http.get('/api/v1/summary/status', ({ request }) => {
    const url = new URL(request.url);
    const item = url.searchParams.get('item');
    if (item === 'job') {
      return HttpResponse.json({
        total: 5,
        success: 5,
        running: 0,
        error: 0
      })
    } else if (item === 'workflow') {
      return HttpResponse.json({
        total: 1,
        success: 1,
        running: 0,
        error: 0
      })
    }
  }),

  http.get('/api/v1/summary/activity', ({ request }) => {
    const url = new URL(request.url);
    const item = url.searchParams.get('item');
    if (item === 'rule') {
      return HttpResponse.json({
        final_step: 1,
        split_step: 1,
        step1: 1,
        step2: 1

      })
    } else if (item === 'tag') {
      return HttpResponse.json({
        tagA: 1,
        tagB: 1,
        tagC: 1
      })
    }
  }),

  http.get('/api/v1/summary/rule_error', () => {
    return HttpResponse.json({})
  }),

  http.get('/api/v1/summary/rule_duration', () => {
    return HttpResponse.json({
      "final_step": {
        "q1": 0.22,
        "median": 0.22,
        "q3": 0.22,
        "max": 0.22,
        "min": 0.22
      },
      "step2": {
        "q1": 0.22,
        "median": 0.22,
        "q3": 0.22,
        "max": 0.22,
        "min": 0.22
      },
      "split_step": {
        "q1": 0.21,
        "median": 0.21,
        "q3": 0.21,
        "max": 0.21,
        "min": 0.21
      },
      "step1": {
        "q1": 0.17,
        "median": 0.17,
        "q3": 0.17,
        "max": 0.17,
        "min": 0.17
      }
    })
  }),

  http.post('/api/v1/summary/pruning', () => {
    return HttpResponse.json({
      message: "Pruning completed in the mock server. No actual pruning performed."
    })
  }),

  // workflows
  http.get('/api/v1/workflows/users', () => {
    return HttpResponse.json(mockUsers)
  }),

  http.get('/api/v1/workflows/:workflow_id/jobs', ({ params, request }) => {
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') || '20')
    const offset = parseInt(url.searchParams.get('offset') || '0')
    const ruleName = url.searchParams.get('rule_name')
    const status = url.searchParams.get('status')

    let workflow_jobs = mockJobs.jobs

    if (ruleName) {
      workflow_jobs = workflow_jobs.filter(job => job.rule_name === ruleName)
    }
    if (status) {
      workflow_jobs = workflow_jobs.filter(job => job.status === status)
    }

    const paginatedJobs = workflow_jobs.slice(offset, offset + limit)

    return HttpResponse.json({
      jobs: paginatedJobs,
      total: mockJobs.total,
      limit: mockJobs.limit,
      offset: mockJobs.offset,
    })
  }),

  http.get('/api/v1/workflows', ({ request }) => {
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') || '20')
    const offset = parseInt(url.searchParams.get('offset') || '0')
    const status = url.searchParams.get('status')
    const user = url.searchParams.get('user')
    const name = url.searchParams.get('name')
    const tags = url.searchParams.get('tags')

    let filteredWorkflows = [...mockWorkflows]

    // 应用过滤器
    if (status) {
      filteredWorkflows = filteredWorkflows.filter(w => w.status === status)
    }
    if (user) {
      filteredWorkflows = filteredWorkflows.filter(w => w.user === user)
    }
    if (name) {
      filteredWorkflows = filteredWorkflows.filter(w =>
        w.name?.toLowerCase().includes(name.toLowerCase())
      )
    }
    if (tags) {
      filteredWorkflows = filteredWorkflows.filter(w =>
        w.tags?.some(tag => tag.includes(tags))
      )
    }

    const total = filteredWorkflows.length
    const paginatedWorkflows = filteredWorkflows.slice(offset, offset + limit)

    return HttpResponse.json({
      workflows: paginatedWorkflows,
      total,
      limit,
      offset,
    })
  }),

  http.get('/api/v1/workflows/:workflow_id/rule_graph', ({ params }) => {
    console.log("mockRuleGraph is:", mockRuleGraph);
    return HttpResponse.json(structuredClone(mockRuleGraph))
  }),


  http.get('/api/v1/workflows/:workflow_id/detail', ({ params }) => {
    const { workflow_id } = params
    const workflow = mockWorkflows.find(w => w.id === workflow_id)

    if (!workflow) {
      return new HttpResponse(null, { status: 404 })
    }

    return HttpResponse.json({
      "workflow_id": "2225a283-696e-491e-8a62-11369a5e274e",
      "name": "hello flowo",
      "user": "miao",
      "tags": [
        "tagA",
        "tagB",
        "tagC"
      ],
      "started_at": "2025-08-13T11:24:43.239206",
      "end_time": "2025-08-13T11:25:39.318718",
      "status": "SUCCESS",
      "progress": 100,
      "config": {
        "flowo_project_name": "hello flowo",
        "flowo_tags": "tagA,tagB,tagC"
      },
      "snakefile": "/home/haomiao/project/snakemake/flowo-test/snakemake_test/demo/Snakefile",
      "directory": "/home/haomiao/project/snakemake/flowo-test/snakemake_test/demo",
      "configfiles": null,
      "flowo_directory": "/demo"
    })
  }),

  http.get('/api/v1/workflows/:workflow_id/rule_status', ({ params }) => {
    return HttpResponse.json(mockRuleStats)
  }),

  http.get('/api/v1/workflows/:workflow_id/snakefile', ({ params }) => {
    const snakefile = mockSnakefiles || `# Mock Snakefile for workflow ${params.workflow_id}`
    return HttpResponse.text(snakefile)
  }),

  http.get('/api/v1/workflows/:workflow_id/configfiles', ({ params }) => {
    return HttpResponse.json(mockConfigFiles)
  }),

  http.get('/api/v1/workflows/:workflow_id/progress', ({ params, request }) => {
    const url = new URL(request.url)
    const returnTotalJobs = url.searchParams.get('returnTotalJobsNumber') === 'true'

    if (returnTotalJobs) {
      return HttpResponse.json({
        total: 5
      })
    }

    return HttpResponse.json({
      progress: 100,
      completed: 5,
      running: 0
    })
  }),

  http.get('/api/v1/workflows/:workflow_id/timelines', ({ params }) => {
    return HttpResponse.json(mockTimes)
  }),

  http.delete('/api/v1/workflows/:workflow_id', ({ params }) => {
    return HttpResponse.json({
      message: `Workflow ${params.workflow_id} cannot delete in the demo page, please setup your own backend to support this feature.`
    })
  }),

  // jobs 
  http.get('/api/v1/jobs/:job_id/detail', ({ params }) => {
    const jobId = parseInt(params.job_id as string)
    const job = mockJobs.jobs.find(j => j.id === jobId)

    if (!job) {
      return new HttpResponse(null, { status: 404 })
    }

    return HttpResponse.json({
      rule_name: job.rule_name,
      workflow_id: job.workflow_id,
      status: job.status,
      started_at: job.started_at,
      end_time: job.end_time,
      message: job.message,
      wildcards: job.wildcards,
      reason: job.reason,
      resources: job.resources,
    })
  }),

  http.get('/api/v1/jobs/:job_id/logs', ({ params }) => {
    const jobId = parseInt(params.jobId as string)
    const jobLog = { stdout: '', stderr: '' }
    return HttpResponse.json(jobLog)
  }),

  // outputs
  http.get('/api/v1/outputs/:workflow_id/rule_outputs', ({ params, request }) => {
    // get the rule name from request
    const url = new URL(request.url);
    const rule_name = url.searchParams.get('rule_name');
    switch (rule_name) {
      case 'final_step':
        return HttpResponse.json(
          [
            "results/output.txt"
          ])
      case 'split_step':
        return HttpResponse.json([
          "results/part1.txt",
          "results/part2.txt",
          "results/part3.txt"
        ])
      case 'step1':
        return HttpResponse.json(
          [
            "results/step1.txt"
          ])
      case 'step2':
        return HttpResponse.json(
          [
            "results/step2.txt"
          ])
      default:
        return HttpResponse.json([]) // Return empty array if no rule matches
    }
  }),

  // util
  http.get('/api/v1/utils/tags', () => {
    return HttpResponse.json(mockTags)
  }),


  // logs
  http.get('/api/v1/logs/:workflow_id', ({ params }) => {
    return HttpResponse.json(mockLogs)
  }),

  //files
  http.get('/files//demo', () => {
    return HttpResponse.json(
      [
        {
          "name": "results/",
          "size": 4096,
          "url": "./results/",
          "mod_time": "2025-08-13T03:25:38.306500796Z",
          "mode": 2147484141,
          "is_dir": true,
          "is_symlink": false
        },
        {
          "name": "Snakefile",
          "size": 1626,
          "url": "./Snakefile",
          "mod_time": "2025-08-13T03:24:31.976160176Z",
          "mode": 420,
          "is_dir": false,
          "is_symlink": false
        }
      ]
    )
  }),

  http.get('/files//demo/results', () => {
    return HttpResponse.json(
      [
        {
          "name": "output.txt",
          "size": 21,
          "url": "./output.txt",
          "mod_time": "2025-08-13T03:25:38.306500796Z",
          "mode": 420,
          "is_dir": false,
          "is_symlink": false
        },
        {
          "name": "part1.txt",
          "size": 23,
          "url": "./part1.txt",
          "mod_time": "2025-08-13T03:25:23.297316408Z",
          "mode": 420,
          "is_dir": false,
          "is_symlink": false
        },
        {
          "name": "part2.txt",
          "size": 23,
          "url": "./part2.txt",
          "mod_time": "2025-08-13T03:25:23.297316408Z",
          "mode": 420,
          "is_dir": false,
          "is_symlink": false
        },
        {
          "name": "part3.txt",
          "size": 23,
          "url": "./part3.txt",
          "mod_time": "2025-08-13T03:25:23.297316408Z",
          "mode": 420,
          "is_dir": false,
          "is_symlink": false
        },
        {
          "name": "step1.txt",
          "size": 17,
          "url": "./step1.txt",
          "mod_time": "2025-08-13T03:24:54.284177371Z",
          "mode": 420,
          "is_dir": false,
          "is_symlink": false
        },
        {
          "name": "step2.txt",
          "size": 17,
          "url": "./step2.txt",
          "mod_time": "2025-08-13T03:25:09.285322841Z",
          "mode": 420,
          "is_dir": false,
          "is_symlink": false
        }
      ]
    )
  }),
  http.get('/files//demo/results//:file', (params) => {
    const fileName = params.params.file
    switch (fileName) {
      case 'output.txt':
        return HttpResponse.text('Final step completed')
      case 'part1.txt':
        return HttpResponse.text('Splitting step: part 1')
      case 'part2.txt':
        return HttpResponse.text('Splitting step: part 2')
      case 'part3.txt':
        return HttpResponse.text('Splitting step: part 3')
      case 'step1.txt':
        return HttpResponse.text('Step 1 completed')
      case 'step2.txt':
        return HttpResponse.text('Step 2 completed')
    }
  }),
  http.get('/files//demo/results/:file', (params) => {
    const fileName = params.params.file
    switch (fileName) {
      case 'output.txt':
        return HttpResponse.text('Final step completed')
      case 'part1.txt':
        return HttpResponse.text('Splitting step: part 1')
      case 'part2.txt':
        return HttpResponse.text('Splitting step: part 2')
      case 'part3.txt':
        return HttpResponse.text('Splitting step: part 3')
      case 'step1.txt':
        return HttpResponse.text('Step 1 completed')
      case 'step2.txt':
        return HttpResponse.text('Step 2 completed')
    }
  })
]