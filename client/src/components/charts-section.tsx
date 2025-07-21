import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SimulationDataPoint } from "@shared/schema";
import { useEffect, useRef, useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

import { SiteEnergyConfig } from "@shared/schema";

interface ChartsSectionProps {
  data: SimulationDataPoint[];
  currentSlot: number;
  config: SiteEnergyConfig;
}

export function ChartsSection({ data, currentSlot, config }: ChartsSectionProps) {
  const mainChartRef = useRef<HTMLCanvasElement>(null);
  const socChartRef = useRef<HTMLCanvasElement>(null);
  const netChartRef = useRef<HTMLCanvasElement>(null);
  const pvInverterChartRef = useRef<HTMLCanvasElement>(null);
  const mainChartInstance = useRef<any>(null);
  const socChartInstance = useRef<any>(null);
  const netChartInstance = useRef<any>(null);
  const pvInverterChartInstance = useRef<any>(null);
  const [pvInverterChartOpen, setPvInverterChartOpen] = useState(false);

  const initPvInverterChart = async () => {
    if (!pvInverterChartRef.current || pvInverterChartInstance.current) return;
    
    const Chart = (await import('chart.js/auto')).default;
    const ctx = pvInverterChartRef.current.getContext('2d');
    if (ctx) {
      // Generate colors for each inverter
      const colors = [
        '#10B981', '#059669', '#047857', '#065f46', '#064e3b',
        '#3B82F6', '#2563EB', '#1D4ED8', '#1E40AF', '#1E3A8A',
        '#8B5CF6', '#7C3AED', '#6D28D9', '#5B21B6', '#4C1D95',
        '#F59E0B', '#D97706', '#B45309', '#92400E', '#78350F'
      ];

      const datasets = config.pvInverters.map((inverter, index) => ({
        label: `PV Inverter ${index + 1} (${inverter.capacity}kW)`,
        data: [],
        borderColor: colors[index % colors.length],
        backgroundColor: `${colors[index % colors.length]}20`,
        tension: 0.1,
        fill: false,
      }));

      pvInverterChartInstance.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels: [],
          datasets,
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { 
              display: true,
              position: 'top' as const,
              labels: {
                color: '#9CA3AF',
                usePointStyle: true,
                padding: 20,
              }
            },
            tooltip: {
              mode: 'index',
              intersect: false,
              backgroundColor: 'rgba(31, 41, 55, 0.95)',
              titleColor: '#F9FAFB',
              bodyColor: '#F9FAFB',
              borderColor: '#6B7280',
              borderWidth: 1,
              callbacks: {
                labelColor: function(context: any) {
                  const datasetIndex = context.datasetIndex;
                  return {
                    borderColor: colors[datasetIndex % colors.length] || '#9CA3AF',
                    backgroundColor: colors[datasetIndex % colors.length] || '#9CA3AF',
                  };
                },
              },
            },
          },
          scales: {
            y: {
              type: 'linear',
              display: true,
              position: 'left',
              title: {
                display: true,
                text: 'Power (kW)',
                color: '#9CA3AF',
              },
              grid: { color: 'rgba(75, 85, 99, 0.3)' },
              ticks: { color: '#9CA3AF' },
            },
            x: {
              grid: { color: 'rgba(75, 85, 99, 0.3)' },
              ticks: { color: '#9CA3AF' },
            },
          },
        },
      });
      
      // Update the chart with current data
      updateCharts();
    }
  };

  const updateCharts = () => {
    if (mainChartInstance.current && socChartInstance.current && data.length > 0) {
      const visibleData = data.slice(0, currentSlot + 1);
      const labels = visibleData.map(d => d.timeString);
      const prices = visibleData.map(d => d.consumptionPrice);
      const consumption = visibleData.map(d => d.consumption);
      const pvGeneration = visibleData.map(d => d.pvGeneration - d.curtailment);
      const pvForecast = visibleData.map(d => d.pvForecast || 0);
      const batteryPower = visibleData.map(d => d.batteryPower);
      const soc = visibleData.map(d => d.soc);
      const netPower = visibleData.map(d => d.netPower);
      const cost = visibleData.map(d => d.cost);

      const mainChart = mainChartInstance.current;
      const socChart = socChartInstance.current;
      const netChart = netChartInstance.current;
      const pvInverterChart = pvInverterChartInstance.current;

      if (mainChart && mainChart.data && mainChart.data.datasets && mainChart.data.datasets.length >= 5) {
        mainChart.data.labels = labels;
        mainChart.data.datasets[0].data = prices;
        mainChart.data.datasets[1].data = consumption;
        mainChart.data.datasets[2].data = pvGeneration;
        mainChart.data.datasets[3].data = pvForecast;
        mainChart.data.datasets[4].data = batteryPower;
        mainChart.update('none');
      }

      if (netChart && netChart.data && netChart.data.datasets && netChart.data.datasets.length >= 2) {
        netChart.data.labels = labels;
        netChart.data.datasets[0].data = netPower;
        netChart.data.datasets[1].data = cost;
        netChart.update('none');
      }

      if (socChart && socChart.data && socChart.data.datasets && socChart.data.datasets.length >= 1) {
        socChart.data.labels = labels;
        socChart.data.datasets[0].data = soc;
        if (socChart.options.plugins && (socChart.options as any).plugins.annotation) {
          (socChart.options as any).plugins.annotation.annotations.minSocLine.yMin = config.minSoc;
          (socChart.options as any).plugins.annotation.annotations.minSocLine.yMax = config.minSoc;
          (socChart.options as any).plugins.annotation.annotations.minSocLine.label.content = `Min SoC (${config.minSoc}%)`;
          (socChart.options as any).plugins.annotation.annotations.maxSocLine.yMin = config.maxSoc;
          (socChart.options as any).plugins.annotation.annotations.maxSocLine.yMax = config.maxSoc;
          (socChart.options as any).plugins.annotation.annotations.maxSocLine.label.content = `Max SoC (${config.maxSoc}%)`;
        }
        socChart.update('none');
      }

      // Update PV inverter chart
      if (pvInverterChart && pvInverterChart.data && pvInverterChart.data.datasets) {
        pvInverterChart.data.labels = labels;
        
        // Update datasets for each inverter
        config.pvInverters.forEach((inverter, index) => {
          if (pvInverterChart.data.datasets[index]) {
            const inverterData = visibleData.map(d => {
              const inverterGeneration = d.pvInverterGenerations.find(gen => gen.inverterId === inverter.id);
              return inverterGeneration ? inverterGeneration.generation : 0;
            });
            pvInverterChart.data.datasets[index].data = inverterData;
          }
        });
        
        pvInverterChart.update('none');
      }
    }
  };

  useEffect(() => {
    const initCharts = async () => {
      const Chart = (await import('chart.js/auto')).default;
      const annotationPlugin = (await import('chartjs-plugin-annotation')).default;
      
      // Register Chart.js plugins
      Chart.register(annotationPlugin);
      Chart.register({
        id: 'customTooltip',
        afterDatasetsDraw: function(chart: any) {
          // Custom tooltip functionality will be handled by Chart.js built-in tooltips
        }
      });
      
      if (mainChartRef.current && !mainChartInstance.current) {
        const ctx = mainChartRef.current.getContext('2d');
        if (ctx) {
          mainChartInstance.current = new Chart(ctx, {
            type: 'line',
            data: {
              labels: [],
              datasets: [
                {
                  label: 'Consumption Price (€/MWh)',
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
                  label: 'PV Forecast (kW)',
                  data: [],
                  borderColor: '#6EE7B7',
                  backgroundColor: 'rgba(110, 231, 183, 0.1)',
                  yAxisID: 'y',
                  tension: 0.1,
                  borderDash: [5, 5],
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
              interaction: {
                mode: 'index',
                intersect: false,
              },
              plugins: {
                legend: {
                  display: false,
                },
                tooltip: {
                  mode: 'index',
                  intersect: false,
                  backgroundColor: 'rgba(31, 41, 55, 0.95)',
                  titleColor: '#F9FAFB',
                  bodyColor: '#F9FAFB',
                  borderColor: '#6B7280',
                  borderWidth: 1,
                  filter: function(tooltipItem: any) {
                    // Only show consumption price (dataset index 0) and other non-price datasets
                    return tooltipItem.datasetIndex === 0 || tooltipItem.datasetIndex > 0;
                  },
                  callbacks: {
                    labelColor: function(context: any) {
                      const datasetIndex = context.datasetIndex;
                      const colors = ['#F59E0B', '#EF4444', '#10B981', '#6EE7B7', '#3B82F6'];
                      return {
                        borderColor: colors[datasetIndex] || '#9CA3AF',
                        backgroundColor: colors[datasetIndex] || '#9CA3AF',
                      };
                    },
                    afterBody: function(context: any) {
                      // Add injection price to tooltip
                      const dataIndex = context[0].dataIndex;
                      const injectionPrice = data[dataIndex]?.injectionPrice;
                      if (injectionPrice !== undefined) {
                        return [
                          '',
                          `Injection Price: €${injectionPrice.toFixed(0)}/MWh`
                        ];
                      }
                      return [];
                    }
                  }
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
                tooltip: {
                  backgroundColor: 'rgba(17, 24, 39, 0.95)',
                  titleColor: '#F9FAFB',
                  bodyColor: '#F9FAFB',
                  borderColor: '#6B7280',
                  borderWidth: 1,
                  callbacks: {
                    labelColor: function(context: any) {
                      return {
                        borderColor: '#8B5CF6',
                        backgroundColor: '#8B5CF6',
                      };
                    },

                  }
                },
                annotation: {
                  annotations: {
                    minSocLine: {
                      type: 'line',
                      yMin: config.minSoc,
                      yMax: config.minSoc,
                      borderColor: '#EF4444',
                      borderWidth: 2,
                      borderDash: [5, 5],
                      label: {
                        content: `Min SoC (${config.minSoc}%)`,
                        enabled: true,
                        position: 'start',
                        color: '#EF4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        borderColor: '#EF4444',
                        borderWidth: 1,
                        borderRadius: 4,
                        padding: 4,
                        font: {
                          size: 10,
                        },
                      },
                    },
                    maxSocLine: {
                      type: 'line',
                      yMin: config.maxSoc,
                      yMax: config.maxSoc,
                      borderColor: '#10B981',
                      borderWidth: 2,
                      borderDash: [5, 5],
                      label: {
                        content: `Max SoC (${config.maxSoc}%)`,
                        enabled: true,
                        position: 'start',
                        color: '#10B981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        borderColor: '#10B981',
                        borderWidth: 1,
                        borderRadius: 4,
                        padding: 4,
                        font: {
                          size: 10,
                        },
                      },
                    },
                  },
                } as any,
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

      if (netChartRef.current && !netChartInstance.current) {
        const ctx = netChartRef.current.getContext('2d');
        if (ctx) {
          netChartInstance.current = new Chart(ctx, {
            type: 'line',
            data: {
              labels: [],
              datasets: [
                {
                  label: 'Net Power (kW)',
                  data: [],
                  borderColor: '#FACC15',
                  backgroundColor: 'rgba(250, 204, 21, 0.1)',
                  yAxisID: 'y',
                  tension: 0.1,
                },
                {
                  label: 'Cost (€)',
                  data: [],
                  borderColor: '#6366F1',
                  backgroundColor: 'rgba(99, 102, 241, 0.1)',
                  yAxisID: 'y1',
                  tension: 0.1,
                },
              ],
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              interaction: { mode: 'index', intersect: false },
              plugins: {
                legend: { display: false },
                tooltip: {
                  mode: 'index',
                  intersect: false,
                  backgroundColor: 'rgba(31, 41, 55, 0.95)',
                  titleColor: '#F9FAFB',
                  bodyColor: '#F9FAFB',
                  borderColor: '#6B7280',
                  borderWidth: 1,
                  callbacks: {
                    labelColor: function(context: any) {
                      const datasetIndex = context.datasetIndex;
                      const colors = ['#FACC15', '#6366F1'];
                      return {
                        borderColor: colors[datasetIndex] || '#9CA3AF',
                        backgroundColor: colors[datasetIndex] || '#9CA3AF',
                      };
                    },
                  },
                },
              },
              scales: {
                y: {
                  type: 'linear',
                  display: true,
                  position: 'left',
                  grid: { color: 'rgba(75, 85, 99, 0.3)' },
                  ticks: { color: '#9CA3AF' },
                },
                y1: {
                  type: 'linear',
                  display: true,
                  position: 'right',
                  grid: { drawOnChartArea: false },
                  ticks: { color: '#9CA3AF' },
                },
                x: {
                  grid: { color: 'rgba(75, 85, 99, 0.3)' },
                  ticks: { color: '#9CA3AF' },
                },
              },
            },
          });
        }
      }

      updateCharts();
    };

    initCharts();
  }, []);

  useEffect(() => {
    updateCharts();
  }, [data, currentSlot]);

  // Initialize PV inverter chart when section is expanded
  useEffect(() => {
    if (pvInverterChartOpen && !pvInverterChartInstance.current) {
      // Small delay to ensure the DOM is ready
      const timer = setTimeout(() => {
        initPvInverterChart();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [pvInverterChartOpen]);

  return (
    <div className="space-y-6">
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-gray-50">Simulation Results</CardTitle>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                <span className="text-sm text-gray-300">Consumption Price</span>
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
                <div className="w-3 h-3 bg-emerald-300 rounded-full border-2 border-dashed border-emerald-300"></div>
                <span className="text-sm text-gray-300">PV Forecast</span>
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

      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-gray-50">Net Power & Cost</CardTitle>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                <span className="text-sm text-gray-300">Net Power</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-indigo-500 rounded-full"></div>
                <span className="text-sm text-gray-300">Cost</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-64 w-full">
            <canvas ref={netChartRef}></canvas>
          </div>
        </CardContent>
      </Card>

      <Collapsible open={pvInverterChartOpen} onOpenChange={setPvInverterChartOpen}>
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-gray-50">PV Inverter Production</CardTitle>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" className="text-gray-400">
                <ChevronDown className={cn("h-4 w-4 transition-transform", pvInverterChartOpen ? "rotate-180" : "")} />
              </Button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              <div className="h-80 w-full">
                <canvas ref={pvInverterChartRef}></canvas>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
