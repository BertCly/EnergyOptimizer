import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SimulationDataPoint } from "@shared/schema";
import { useEffect, useRef } from "react";

interface ChartsSectionProps {
  data: SimulationDataPoint[];
  currentSlot: number;
}

export function ChartsSection({ data, currentSlot }: ChartsSectionProps) {
  const mainChartRef = useRef<HTMLCanvasElement>(null);
  const socChartRef = useRef<HTMLCanvasElement>(null);
  const mainChartInstance = useRef<any>(null);
  const socChartInstance = useRef<any>(null);

  useEffect(() => {
    const initCharts = async () => {
      const Chart = (await import('chart.js/auto')).default;
      
      if (mainChartRef.current && !mainChartInstance.current) {
        const ctx = mainChartRef.current.getContext('2d');
        if (ctx) {
          mainChartInstance.current = new Chart(ctx, {
            type: 'line',
            data: {
              labels: [],
              datasets: [
                {
                  label: 'Price (€/kWh)',
                  data: [],
                  borderColor: '#F59E0B',
                  backgroundColor: 'rgba(245, 158, 11, 0.1)',
                  yAxisID: 'y1',
                  tension: 0.1,
                },
                {
                  label: 'Consumption (kW)',
                  data: [],
                  borderColor: '#EF4444',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  yAxisID: 'y',
                  tension: 0.1,
                },
                {
                  label: 'PV Generation (kW)',
                  data: [],
                  borderColor: '#10B981',
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  yAxisID: 'y',
                  tension: 0.1,
                },
                {
                  label: 'Battery Power (kW)',
                  data: [],
                  borderColor: '#3B82F6',
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  yAxisID: 'y',
                  tension: 0.1,
                },
              ],
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  display: false,
                },
              },
              scales: {
                y: {
                  type: 'linear',
                  display: true,
                  position: 'left',
                  grid: {
                    color: 'rgba(75, 85, 99, 0.3)',
                  },
                  ticks: {
                    color: '#9CA3AF',
                  },
                },
                y1: {
                  type: 'linear',
                  display: true,
                  position: 'right',
                  grid: {
                    drawOnChartArea: false,
                  },
                  ticks: {
                    color: '#9CA3AF',
                  },
                },
                x: {
                  grid: {
                    color: 'rgba(75, 85, 99, 0.3)',
                  },
                  ticks: {
                    color: '#9CA3AF',
                  },
                },
              },
            },
          });
        }
      }

      if (socChartRef.current && !socChartInstance.current) {
        const ctx = socChartRef.current.getContext('2d');
        if (ctx) {
          socChartInstance.current = new Chart(ctx, {
            type: 'line',
            data: {
              labels: [],
              datasets: [
                {
                  label: 'SoC (%)',
                  data: [],
                  borderColor: '#8B5CF6',
                  backgroundColor: 'rgba(139, 92, 246, 0.1)',
                  fill: true,
                  tension: 0.1,
                },
              ],
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  display: false,
                },
              },
              scales: {
                y: {
                  min: 0,
                  max: 100,
                  grid: {
                    color: 'rgba(75, 85, 99, 0.3)',
                  },
                  ticks: {
                    color: '#9CA3AF',
                  },
                },
                x: {
                  grid: {
                    color: 'rgba(75, 85, 99, 0.3)',
                  },
                  ticks: {
                    color: '#9CA3AF',
                  },
                },
              },
            },
          });
        }
      }
    };

    initCharts();
  }, []);

  useEffect(() => {
    if (mainChartInstance.current && socChartInstance.current && data.length > 0) {
      const visibleData = data.slice(0, currentSlot + 1);
      const labels = visibleData.map(d => d.timeString);
      const prices = visibleData.map(d => d.price);
      const consumption = visibleData.map(d => d.consumption);
      const pvGeneration = visibleData.map(d => d.pvGeneration);
      const batteryPower = visibleData.map(d => d.batteryPower);
      const soc = visibleData.map(d => d.soc);

      mainChartInstance.current.data.labels = labels;
      mainChartInstance.current.data.datasets[0].data = prices;
      mainChartInstance.current.data.datasets[1].data = consumption;
      mainChartInstance.current.data.datasets[2].data = pvGeneration;
      mainChartInstance.current.data.datasets[3].data = batteryPower;
      mainChartInstance.current.update('none');

      socChartInstance.current.data.labels = labels;
      socChartInstance.current.data.datasets[0].data = soc;
      socChartInstance.current.update('none');
    }
  }, [data, currentSlot]);

  return (
    <div className="space-y-6">
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-gray-50">Simulation Results</CardTitle>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                <span className="text-sm text-gray-300">Price</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span className="text-sm text-gray-300">Consumption</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                <span className="text-sm text-gray-300">PV Generation</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="text-sm text-gray-300">Battery Power</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-96 w-full">
            <canvas ref={mainChartRef}></canvas>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-gray-50">Battery State of Charge</CardTitle>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
              <span className="text-sm text-gray-300">SoC (%)</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-64 w-full">
            <canvas ref={socChartRef}></canvas>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
