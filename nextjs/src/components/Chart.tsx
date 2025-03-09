import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartData,
  ChartOptions
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface ChartProps {
  confidenceData: number[];
  stressData: number[];
  labels?: string[]; // Optional custom labels (e.g., dates or time periods)
}

const Chart: React.FC<ChartProps> = ({ confidenceData, stressData, labels }) => {
  // Generate default labels if not provided
  const defaultLabels = confidenceData.map((_, index) => `Point ${index + 1}`);
  const chartLabels = labels || defaultLabels;

  const data: ChartData<'line'> = {
    labels: chartLabels,
    datasets: [
      {
        label: 'Confidence',
        data: confidenceData,
        borderColor: 'rgb(53, 162, 235)',
        backgroundColor: 'rgba(53, 162, 235, 0.5)',
        tension: 0.3,
      },
      {
        label: 'Stress',
        data: stressData,
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
        tension: 0.3,
      },
    ],
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Confidence and Stress Levels',
      },
    },
    scales: {
      y: {
        min: 0,
        max: 100, // Assuming values are on a 0-100 scale, adjust as needed
        ticks: {
          stepSize: 10,
        },
      },
    },
  };

  return (
    <div style={{ height: '300px', width: '100%' }}>
      <Line data={data} options={options} />
    </div>
  );
};

export default Chart;
