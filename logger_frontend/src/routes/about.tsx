import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  component: About,
})

function About() {
  return (
    <div>
      <h2>About Snakemake Logger</h2>
      <p>This is a frontend application for monitoring Snakemake workflow executions.</p>
      <ul>
        <li>View workflow execution history</li>
        <li>Monitor job statuses and details</li>
        <li>Visualize workflow rule dependencies</li>
        <li>Interactive graph-based job filtering</li>
      </ul>
    </div>
  )
}
