import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";
import { ConfigurationPanel } from "./configuration-panel";
import { ChartsSection } from "./charts-section";
import { DataTable } from "./data-table";
import { BatteryConfig, SimulationDataPoint, batteryConfigSchema } from "@shared/schema";
import { generateSimulationData } from "@/lib/data-generator";
import { controlCycle } from "@/lib/optimization-algorithm";

export function BatterySimulator() {
  const [config, setConfig] = useState<BatteryConfig>(batteryConfigSchema.parse({}));
  const [simulationData, setSimulationData] = useState<SimulationDataPoint[]>([]);
  const [currentSlot, setCurrentSlot] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [totalCost, setTotalCost] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const currentStatus = {
    soc: simulationData[currentSlot]?.soc || config.initialSoc,
    batteryPower: simulationData[currentSlot]?.batteryPower || 0,
    currentPrice: simulationData[currentSlot]?.price || 0,
    totalCost,
  };

  const startSimulation = () => {
    if (isRunning) return;

    setIsRunning(true);
    setCurrentSlot(0);
    setTotalCost(0);
    
    const data = generateSimulationData(config.initialSoc);
    setSimulationData(data);

    intervalRef.current = setInterval(() => {
      setCurrentSlot(prev => {
        const nextSlot = prev + 1;
        if (nextSlot >= data.length) {
          stopSimulation();
          return prev;
        }
        return nextSlot;
      });
    }, 500);
  };

  const stopSimulation = () => {
    setIsRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    if (isRunning && currentSlot < simulationData.length) {
      const updatedData = [...simulationData];
      const current = updatedData[currentSlot];
      
      // Apply control cycle algorithm
      const decision = controlCycle(currentSlot, updatedData, config);
      
      // Update battery power
      current.batteryPower = decision.batteryPower;
      
      // Calculate net power (positive = from grid, negative = to grid)
      current.netPower = current.consumption - current.pvGeneration - current.batteryPower;
      
      // Calculate cost for this interval (15 minutes = 0.25 hours)
      current.cost = Math.max(0, current.netPower) * current.price * 0.25;
      
      // Update SoC based on battery power
      const energyChange = current.batteryPower * 0.25; // kWh for 15-min interval
      const socChange = (energyChange / config.batteryCapacity) * 100;
      current.soc = Math.max(config.minSoc, Math.min(config.maxSoc, current.soc + socChange));
      
      // Update next slot's initial SoC
      if (currentSlot < simulationData.length - 1) {
        updatedData[currentSlot + 1].soc = current.soc;
      }
      
      setSimulationData(updatedData);
      setTotalCost(prev => prev + current.cost);
    }
  }, [currentSlot, isRunning, config, simulationData]);

  const handleExportData = () => {
    if (simulationData.length === 0) {
      alert('No simulation data to export. Please run a simulation first.');
      return;
    }
    
    const visibleData = simulationData.slice(0, currentSlot + 1);
    const csvData = visibleData.map(d => 
      `${d.timeString},${d.price.toFixed(3)},${d.consumption.toFixed(1)},${d.pvGeneration.toFixed(1)},${d.batteryPower.toFixed(1)},${d.soc.toFixed(1)},${d.netPower.toFixed(1)},${d.cost.toFixed(3)}`
    ).join('\n');
    
    const csv = 'Time,Price (€/kWh),Consumption (kW),PV Generation (kW),Battery Power (kW),SoC (%),Net Power (kW),Cost (€)\n' + csvData;
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'battery_simulation_data.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleClearLog = () => {
    setSimulationData([]);
    setCurrentSlot(0);
    setTotalCost(0);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-50">
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-semibold text-gray-50">Battery Cost Optimization Simulator</h1>
          </div>
          <div className="flex items-center space-x-4">
            <Button
              onClick={isRunning ? stopSimulation : startSimulation}
              className="bg-blue-500 hover:bg-blue-600 text-white font-medium"
            >
              {isRunning ? 'Stop Simulation' : 'Run Simulation'}
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <ConfigurationPanel
              config={config}
              onConfigChange={setConfig}
              currentStatus={currentStatus}
            />
          </div>

          <div className="lg:col-span-3">
            <ChartsSection data={simulationData} currentSlot={currentSlot} />
          </div>
        </div>

        <div className="mt-6">
          <DataTable
            data={simulationData}
            currentSlot={currentSlot}
            onClearLog={handleClearLog}
            onExportData={handleExportData}
          />
        </div>
      </div>
    </div>
  );
}
