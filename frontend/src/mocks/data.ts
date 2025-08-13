// 模拟数据文件
export const mockWorkflows = [
  {
    "id": "2225a283-696e-491e-8a62-11369a5e274e",
    "directory": "/home/haomiao/project/snakemake/flowo-test/snakemake_test/demo",
    "snakefile": true,
    "started_at": "2025-08-13T11:24:43.239206", "end_time": "2025-08-13T11:25:39.318718", "status": "SUCCESS", "user": "miao", "name": "hello flowo", "configfiles": false, "tags": ["tagA", "tagB", "tagC"], "progress": 100, "total_jobs": 5
  }
]

export const mockJobs = {
  "jobs": [
    {
      "id": 5,
      "rule_id": 5,
      "rule_name": "all",
      "workflow_id": "2225a283-696e-491e-8a62-11369a5e274e",
      "status": "SUCCESS",
      "started_at": "2025-08-13T11:25:38.341983",
      "end_time": "2025-08-13T11:25:38.405751",
      "threads": 1,
      "priority": 0,
      "message": null,
      "shellcmd": null,
      "wildcards": {},
      "reason": "Input files updated by another job: results/output.txt",
      "resources": {
        "tmpdir": "/tmp"
      }
    },
    {
      "id": 4,
      "rule_id": 4,
      "rule_name": "final_step",
      "workflow_id": "2225a283-696e-491e-8a62-11369a5e274e",
      "status": "SUCCESS",
      "started_at": "2025-08-13T11:25:23.410759",
      "end_time": "2025-08-13T11:25:38.314543",
      "threads": 1,
      "priority": 0,
      "message": null,
      "shellcmd": "\n        sleep $((RANDOM % 11 + 10))  # Sleep for a random time between 10 and 20 seconds\n        echo 'Final step completed' > results/output.txt\n        ",
      "wildcards": {},
      "reason": "Missing output files: results/output.txt; Input files updated by another job: results/part1.txt, results/part3.txt, results/part2.txt",
      "resources": {
        "tmpdir": "/tmp"
      }
    },
    {
      "id": 3,
      "rule_id": 3,
      "rule_name": "split_step",
      "workflow_id": "2225a283-696e-491e-8a62-11369a5e274e",
      "status": "SUCCESS",
      "started_at": "2025-08-13T11:25:09.339100",
      "end_time": "2025-08-13T11:25:23.306602",
      "threads": 1,
      "priority": 0,
      "message": null,
      "shellcmd": "\n        sleep $((RANDOM % 11 + 10))  # Sleep for a random time between 10 and 20 seconds\n        echo 'Splitting step: part 1' > results/part1.txt\n        echo 'Splitting step: part 2' > results/part2.txt\n        echo 'Splitting step: part 3' > results/part3.txt\n        ",
      "wildcards": {},
      "reason": "Missing output files: results/part1.txt, results/part2.txt, results/part3.txt; Input files updated by another job: results/step2.txt",
      "resources": {
        "tmpdir": "/tmp"
      }
    },
    {
      "id": 2,
      "rule_id": 2,
      "rule_name": "step2",
      "workflow_id": "2225a283-696e-491e-8a62-11369a5e274e",
      "status": "SUCCESS",
      "started_at": "2025-08-13T11:24:54.327369",
      "end_time": "2025-08-13T11:25:09.298422",
      "threads": 1,
      "priority": 0,
      "message": null,
      "shellcmd": "\n        sleep $((RANDOM % 11 + 10))  # Sleep for a random time between 10 and 20 seconds\n        echo 'Step 2 completed' > results/step2.txt\n        ",
      "wildcards": {},
      "reason": "Missing output files: results/step2.txt; Input files updated by another job: results/step1.txt",
      "resources": {
        "tmpdir": "/tmp"
      }
    },
    {
      "id": 1,
      "rule_id": 1,
      "rule_name": "step1",
      "workflow_id": "2225a283-696e-491e-8a62-11369a5e274e",
      "status": "SUCCESS",
      "started_at": "2025-08-13T11:24:43.419776",
      "end_time": "2025-08-13T11:24:54.291310",
      "threads": 1,
      "priority": 0,
      "message": null,
      "shellcmd": "\n        sleep $((RANDOM % 11 + 10))  # Sleep for a random time between 10 and 20 seconds\n        echo 'Step 1 completed' > results/step1.txt\n        ",
      "wildcards": {},
      "reason": "Missing output files: results/step1.txt",
      "resources": {
        "tmpdir": "/tmp"
      }
    }
  ],
  "total": 5,
  "limit": 50,
  "offset": 0
}

export const mockUsers = ['alice', 'bob', 'charlie', 'david', 'eve']

export const mockTags = [
  "tagA", "tagB", "tagC"
]

export const mockSnakefiles = "# Snakefile\n\n# Define the final output file for the workflow\nrule all:\n    input:\n        \"results/output.txt\"\n\n# Step 1: Simulate a process with random sleep using bash's $RANDOM\nrule step1:\n    output:\n        \"results/step1.txt\"\n    shell:\n        \"\"\"\n        sleep $((RANDOM % 11 + 10))  # Sleep for a random time between 10 and 20 seconds\n        echo 'Step 1 completed' > {output}\n        \"\"\"\n\n# Step 2: Simulate a process with random sleep using bash's $RANDOM\nrule step2:\n    input:\n        \"results/step1.txt\"\n    output:\n        \"results/step2.txt\"\n    shell:\n        \"\"\"\n        sleep $((RANDOM % 11 + 10))  # Sleep for a random time between 10 and 20 seconds\n        echo 'Step 2 completed' > {output}\n        \"\"\"\n\n# Step 3: Simulate splitting and creating multiple files with random sleep\nrule split_step:\n    input:\n        \"results/step2.txt\"\n    output:\n        \"results/part1.txt\",\n        \"results/part2.txt\",\n        \"results/part3.txt\"\n    shell:\n        \"\"\"\n        sleep $((RANDOM % 11 + 10))  # Sleep for a random time between 10 and 20 seconds\n        echo 'Splitting step: part 1' > {output[0]}\n        echo 'Splitting step: part 2' > {output[1]}\n        echo 'Splitting step: part 3' > {output[2]}\n        \"\"\"\n\n# Final Step: Simulate final output creation with random sleep\nrule final_step:\n    input:\n        \"results/part1.txt\",\n        \"results/part2.txt\",\n        \"results/part3.txt\"\n    output:\n        \"results/output.txt\"\n    shell:\n        \"\"\"\n        sleep $((RANDOM % 11 + 10))  # Sleep for a random time between 10 and 20 seconds\n        echo 'Final step completed' > {output}\n        \"\"\"\n"

export const mockConfigFiles = {
  'config.yaml': `samples: 
  - sample1
  - sample2
threads: 4`,
  'cluster.yaml': `default:
  partition: "short"
  time: "1:00:00"`
}

export const mockLogs = {
  "workflow_id": "2225a283-696e-491e-8a62-11369a5e274e",
  "log_file": "/home/haomiao/project/snakemake/flowo-test/snakemake_test/demo/flowo_logs/log_e41cf0e0-4583-4a52-9940-b01af55a258a.log",
  "content": "Assuming unrestricted shared filesystem usage.\nNone\nhost: DESKTOP-3LK3508\nBuilding DAG of jobs...\nNone\nUsing shell: /usr/bin/bash\nProvided cores: 12\nRules claiming more threads will be scaled down.\nJob stats:\njob           count\n----------  -------\nall               1\nfinal_step        1\nsplit_step        1\nstep1             1\nstep2             1\ntotal             5\n\nSelect jobs to execute...\nExecute 1 jobs...\n[Wed Aug 13 11:24:43 2025]\nlocalrule step1:\n    output: results/step1.txt\n    jobid: 4\n    reason: Missing output files: results/step1.txt\n    resources: tmpdir=/tmp\nShell command: \n        sleep $((RANDOM % 11 + 10))  # Sleep for a random time between 10 and 20 seconds\n        echo 'Step 1 completed' > results/step1.txt\n        \n[Wed Aug 13 11:24:54 2025]\nFinished jobid: 4 (Rule: step1)\n1 of 5 steps (20%) done\nSelect jobs to execute...\nExecute 1 jobs...\n[Wed Aug 13 11:24:54 2025]\nlocalrule step2:\n    input: results/step1.txt\n    output: results/step2.txt\n    jobid: 3\n    reason: Missing output files: results/step2.txt; Input files updated by another job: results/step1.txt\n    resources: tmpdir=/tmp\nShell command: \n        sleep $((RANDOM % 11 + 10))  # Sleep for a random time between 10 and 20 seconds\n        echo 'Step 2 completed' > results/step2.txt\n        \n[Wed Aug 13 11:25:09 2025]\nFinished jobid: 3 (Rule: step2)\n2 of 5 steps (40%) done\nSelect jobs to execute...\nExecute 1 jobs...\n[Wed Aug 13 11:25:09 2025]\nlocalrule split_step:\n    input: results/step2.txt\n    output: results/part1.txt, results/part2.txt, results/part3.txt\n    jobid: 2\n    reason: Missing output files: results/part1.txt, results/part2.txt, results/part3.txt; Input files updated by another job: results/step2.txt\n    resources: tmpdir=/tmp\nShell command: \n        sleep $((RANDOM % 11 + 10))  # Sleep for a random time between 10 and 20 seconds\n        echo 'Splitting step: part 1' > results/part1.txt\n        echo 'Splitting step: part 2' > results/part2.txt\n        echo 'Splitting step: part 3' > results/part3.txt\n        \n[Wed Aug 13 11:25:23 2025]\nFinished jobid: 2 (Rule: split_step)\n3 of 5 steps (60%) done\nSelect jobs to execute...\nExecute 1 jobs...\n[Wed Aug 13 11:25:23 2025]\nlocalrule final_step:\n    input: results/part1.txt, results/part2.txt, results/part3.txt\n    output: results/output.txt\n    jobid: 1\n    reason: Missing output files: results/output.txt; Input files updated by another job: results/part1.txt, results/part3.txt, results/part2.txt\n    resources: tmpdir=/tmp\nShell command: \n        sleep $((RANDOM % 11 + 10))  # Sleep for a random time between 10 and 20 seconds\n        echo 'Final step completed' > results/output.txt\n        \n[Wed Aug 13 11:25:38 2025]\nFinished jobid: 1 (Rule: final_step)\n4 of 5 steps (80%) done\nSelect jobs to execute...\nExecute 1 jobs...\n[Wed Aug 13 11:25:38 2025]\nlocalrule all:\n    input: results/output.txt\n    jobid: 0\n    reason: Input files updated by another job: results/output.txt\n    resources: tmpdir=/tmp\nShell command: None\n[Wed Aug 13 11:25:38 2025]\nFinished jobid: 0 (Rule: all)\n5 of 5 steps (100%) done\nComplete log(s): /home/haomiao/project/snakemake/flowo-test/snakemake_test/demo/.snakemake/log/2025-08-13T112443.237353.snakemake.log\n"
}

export const mockJobLogs = {
  1: {
    stdout: `Job stdout...`,
    stderr: ``
  }
}

export const mockRuleGraph = {
  "nodes":
    [{ "rule": "step1" }, { "rule": "step2" }, { "rule": "split_step" }, { "rule": "final_step" }, { "rule": "all" }],
  "links": [{ "source": 0, "target": 1, "sourcerule": "step1", "targetrule": "step2" }, { "source": 1, "target": 2, "sourcerule": "step2", "targetrule": "split_step" }, { "source": 2, "target": 3, "sourcerule": "split_step", "targetrule": "final_step" }, { "source": 3, "target": 4, "sourcerule": "final_step", "targetrule": "all" }]
}

export const mockRuleStats = {
  "all": {
    "success": "1",
    "running": "0",
    "error": "0",
    "total": "1",
    "status": "SUCCESS"
  },
  "final_step": {
    "success": "1",
    "running": "0",
    "error": "0",
    "total": "1",
    "status": "SUCCESS"
  },
  "split_step": {
    "success": "1",
    "running": "0",
    "error": "0",
    "total": "1",
    "status": "SUCCESS"
  },
  "step1": {
    "success": "1",
    "running": "0",
    "error": "0",
    "total": "1",
    "status": "SUCCESS"
  },
  "step2": {
    "success": "1",
    "running": "0",
    "error": "0",
    "total": "1",
    "status": "SUCCESS"
  }
}

export const mockTimes = {
  "step1": [
    [
      "step1 1/1",
      "2025-08-13T11:24:43.419776",
      "2025-08-13T11:24:54.291310",
      "SUCCESS"
    ]
  ],
  "step2": [
    [
      "step2 1/1",
      "2025-08-13T11:24:54.327369",
      "2025-08-13T11:25:09.298422",
      "SUCCESS"
    ]
  ],
  "split_step": [
    [
      "split_step 1/1",
      "2025-08-13T11:25:09.339100",
      "2025-08-13T11:25:23.306602",
      "SUCCESS"
    ]
  ],
  "final_step": [
    [
      "final_step 1/1",
      "2025-08-13T11:25:23.410759",
      "2025-08-13T11:25:38.314543",
      "SUCCESS"
    ]
  ],
  "all": [
    [
      "all 1/1",
      "2025-08-13T11:25:38.341983",
      "2025-08-13T11:25:38.405751",
      "SUCCESS"
    ]
  ]
}