'use client';

import Chart, {type ChartDataset, type ChartOptions} from 'chart.js/auto';
import {memo, useEffect, useRef} from 'react';
import {useTheme} from 'styled-components';

type LineChartProps = React.DetailedHTMLProps<React.CanvasHTMLAttributes<HTMLCanvasElement>, HTMLCanvasElement> & {
  labels: string[];
  datasets: ChartDataset<'line', number[]>[];
  options?: ChartOptions<'line'>;
};

const LineChart: React.FC<LineChartProps> = ({labels, datasets, options, ...restProps}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  const theme = useTheme();

  useEffect(() => {
    if (!canvasRef.current) return;

    // Remove the previous chart instance if it exists
    if (chartInstance.current) {
      chartInstance.current.destroy();
      chartInstance.current = null;
    }

    // Default chart settings
    Chart.defaults.borderColor = theme.colors.border;
    Chart.defaults.color = theme.colors.text;
    Chart.defaults.font = {
      family: theme.fonts.default,
      size: 14,
    };

    // If the font is not loaded yet, wait for it to load and then update the chart
    // https://www.chartjs.org/docs/latest/general/fonts.html#loading-fonts
    if (!document.fonts.check(`1em ${theme.fonts.default}`)) {
      document.fonts.load(`1em ${theme.fonts.default}`).then(() => {
        if (chartInstance.current) {
          chartInstance.current.update();
        }
      });
    }

    // Default dataset options
    const defaultDatasetOptions: Partial<LineChartProps['datasets'][number]> = {
      borderWidth: 3,
      borderJoinStyle: 'round',
      tension: 0.25,
    };

    // Initialize the chart
    chartInstance.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels,
        datasets: datasets.map((dataset) => ({
          ...defaultDatasetOptions,
          ...dataset,
        })),
      },
      options: {
        ...options,
        scales: {
          ...options?.scales,
          y: {
            beginAtZero: true,
            ...options?.scales?.y,
          },
        },
      },
    });

    return () => {
      // Clean up the chart instance
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [theme, labels, datasets, options]);

  return <canvas ref={canvasRef} {...restProps} />;
};

export default memo(LineChart);
