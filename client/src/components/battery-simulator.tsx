import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";
import { ConfigurationPanel } from "./configuration-panel";
import { ChartsSection } from "./charts-section";
import { EditableDataTable } from "./editable-data-table";

import { BatteryConfig, SimulationDataPoint, batteryConfigSchema } from "@shared/schema";
import { generateSimulationData } from "@/lib/data-generator";
import { controlCycle } from "@/lib/optimization-algorithm";

export function BatterySimulator() {
  const [config, setConfig] = useState<BatteryConfig>(batteryConfigSchema.parse({}));
  const [simulationData, setSimulationData] = useState<SimulationDataPoint[]>(() => 
    generateSimulationData(batteryConfigSchema.parse({}).initialSoc)
  );
  const [currentSlot, setCurrentSlot] = useState(47); // Show all data
  const [isRunning, setIsRunning] = useState(false);
  const [totalCost, setTotalCost] = useState(0);



  const runFullSimulation = () => {
    setIsRunning(true);
    setCurrentSlot(47);
    setTotalCost(0);
    
    const data = generateSimulationData(config.initialSoc);
    const optimizedData = [...data];
    let totalCostAccumulator = 0;
    
    // Run optimization for all slots
    for (let slot = 0; slot < optimizedData.length; slot++) {
      const current = optimizedData[slot];
      
      // Run optimization
      const decision = controlCycle(slot, optimizedData, config);
      
      // Update battery decision
      current.batteryPower = decision.batteryPower;
      current.curtailment = decision.curtailment;
      current.relayState = decision.relayState;
      current.decision = decision.decision;
      
      // Calculate net power (positive = from grid, negative = to grid)
      current.netPower = current.consumption - current.pvGeneration - current.batteryPower;
      
      // Calculate cost for this interval (15 minutes = 0.25 hours)
      const pricePerKWh = current.netPower >= 0 ? current.consumptionPrice : current.injectionPrice;
      current.cost = current.netPower * pricePerKWh * 0.25;
      
      // Update SoC based on battery power
      const energyChange = current.batteryPower * 0.25; // kWh for 15-min interval
      const socChange = (energyChange / config.batteryCapacity) * 100;
      current.soc = Math.max(config.minSoc, Math.min(config.maxSoc, current.soc + socChange));
      
      // Update next slot's initial SoC
      if (slot < optimizedData.length - 1) {
        optimizedData[slot + 1].soc = current.soc;
      }
      
      // Accumulate total cost
      totalCostAccumulator += current.cost;
    }
    
    setSimulationData(optimizedData);
    setTotalCost(totalCostAccumulator);
    setIsRunning(false);
  };

  const startSimulation = runFullSimulation;
  const stopSimulation = () => {
    setIsRunning(false);
  };

  // Run simulation on component mount and when config changes
  useEffect(() => {
    runFullSimulation();
  }, [config]);

  const handleExportData = () => {
    if (simulationData.length === 0) {
      alert('No simulation data to export. Please run a simulation first.');
      return;
    }
    
    const visibleData = simulationData.slice(0, currentSlot + 1);
    const csvData = visibleData.map(d =>
      `${d.timeString},${d.price.toFixed(3)},${d.injectionPrice.toFixed(3)},${d.consumption.toFixed(1)},${d.pvGeneration.toFixed(1)},${d.pvForecast?.toFixed(1) || '0.0'},${d.batteryPower.toFixed(1)},${d.soc.toFixed(1)},${d.decision || 'hold'},${d.relayState ? 'ON' : 'OFF'},${d.curtailment?.toFixed(1) || '0.0'},${d.netPower.toFixed(1)},${d.cost.toFixed(3)}`
    ).join('\n');

    const csv = 'Time,Price (€/kWh),Injection Price (€/kWh),Consumption (kW),PV Generation (kW),PV Forecast (kW),Battery Power (kW),SoC (%),Decision,Relay,Curtailment (kW),Net Power (kW),Cost (€)\n' + csvData;
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'battery_simulation_data.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleClearLog = () => {
    runFullSimulation();
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

      <div className="max-w-screen-2xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <ConfigurationPanel
              config={config}
              onConfigChange={setConfig}
            />
          </div>

          <div className="lg:col-span-2">
            <ChartsSection data={simulationData} currentSlot={currentSlot} />
          </div>
        </div>

        <div className="mt-6 max-w-screen-2xl mx-auto">
          <EditableDataTable
            data={simulationData}
            onDataChange={setSimulationData}
            onClearLog={handleClearLog}
            onExportData={handleExportData}
            isSimulationRunning={isRunning}
          />
        </div>
      </div>
    </div>
  );
}
