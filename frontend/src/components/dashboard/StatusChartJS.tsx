import { Card } from "antd";
import React from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  ChartOptions,
} from "chart.js";

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend);

interface StatusData {
  success: number;
  running: number;
  error: number;
  total: number;
}

interface StatusChartProps {
  title: string;
  data: StatusData;
  loading?: boolean;
}

export const StatusChartJS: React.FC<StatusChartProps> = ({
  title,
  data,
  loading = false,
}) => {
  const chartData = {
    labels: ["Success", "Running", "Error"],
    datasets: [
      {
        data: [data.success, data.running, data.error],
        backgroundColor: ["#37a460", "#85d2ab", "#f5222d"],
        borderWidth: 2,
        borderColor: "#ffffff",
        hoverBorderWidth: 3,
      },
    ],
  };

  const options: ChartOptions<"doughnut"> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "60%", // Creates the donut hole
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          fontSize: 12,
          padding: 20,
        },
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.label || "";
            const value = context.parsed;
            const percentage = ((value / data.total) * 100).toFixed(1);
            return `${label}: ${value} (${percentage}%)`;
          },
        },
      },
    },
    // Custom plugin to draw text in center
    elements: {
      arc: {
        borderRadius: 4,
      },
    },
  };

  // Custom plugin to draw center text
  const centerTextPlugin = {
    id: "centerText",
    beforeDatasetsDraw(chart: any) {
      const { ctx, width, height } = chart;

      ctx.restore();
      const fontSize = Math.min(width, height) / 8;
      ctx.font = `bold ${fontSize}px Arial`;
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#333";

      const centerX = width / 2;
      const centerY = height / 2 - 10;

      // Draw total number
      ctx.textAlign = "center";
      ctx.fillText(data.total.toString(), centerX, centerY);

      // Draw "Total" label
      ctx.font = `500 ${fontSize * 0.4}px Arial`;
      ctx.fillStyle = "#666";
      ctx.fillText("Total", centerX, centerY + fontSize * 0.6);

      ctx.save();
    },
  };

  return (
    <Card title={title} loading={loading} style={{ height: "350px" }}>
      <div
        style={{
          width: "100%",
          height: "280px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {!loading && (
          <Doughnut
            data={chartData}
            options={options}
            plugins={[centerTextPlugin]}
          />
        )}
        {loading && (
          <div style={{ textAlign: "center", color: "#666" }}>
            Loading chart...
          </div>
        )}
      </div>
    </Card>
  );
};
