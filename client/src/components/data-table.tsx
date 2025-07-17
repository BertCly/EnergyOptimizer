import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SimulationDataPoint } from "@shared/schema";

interface DataTableProps {
  data: SimulationDataPoint[];
  currentSlot: number;
  onClearLog: () => void;
  onExportData: () => void;
}

export function DataTable({ data, currentSlot, onClearLog, onExportData }: DataTableProps) {
  const visibleData = data.slice(0, currentSlot + 1);

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-50">Simulation Data Log</CardTitle>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onExportData}
              className="bg-gray-600 hover:bg-gray-700 border-gray-600 text-gray-50"
            >
              Export Data
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-700">
              <tr className="text-left">
                <th className="pb-3 text-gray-300 font-medium">Time</th>
                <th className="pb-3 text-gray-300 font-medium">Price (€/kWh)</th>
                <th className="pb-3 text-gray-300 font-medium">Consumption (kW)</th>
                <th className="pb-3 text-gray-300 font-medium">PV Generation (kW)</th>
                <th className="pb-3 text-gray-300 font-medium">Battery Power (kW)</th>
                <th className="pb-3 text-gray-300 font-medium">SoC (%)</th>
                <th className="pb-3 text-gray-300 font-medium">Decision</th>
                <th className="pb-3 text-gray-300 font-medium">Relay</th>
                <th className="pb-3 text-gray-300 font-medium">Curtailment (kW)</th>
                <th className="pb-3 text-gray-300 font-medium">Net Power (kW)</th>
                <th className="pb-3 text-gray-300 font-medium">Cost (€)</th>
              </tr>
            </thead>
            <tbody className="text-gray-50">
              {visibleData.map((row, index) => (
                <tr key={index} className="border-b border-gray-700">
                  <td className="py-2 text-gray-300">{row.timeString}</td>
                  <td className="py-2 text-amber-400">€{row.consumptionPrice.toFixed(3)}</td>
                  <td className="py-2 text-red-400">{row.consumption.toFixed(1)}</td>
                  <td className="py-2 text-emerald-400">{row.pvGeneration.toFixed(1)}</td>
                  <td className="py-2 text-blue-400">{row.batteryPower.toFixed(1)}</td>
                  <td className="py-2 text-purple-400">{row.soc.toFixed(1)}</td>
                  <td className="py-2 text-cyan-400" title={row.batteryDecisionReason}>{row.batteryDecision || 'hold'}</td>
                  <td className="py-2 text-orange-400">{row.loadState ? 'ON' : 'OFF'}</td>
                  <td className="py-2 text-pink-400">{row.pvCurtailment?.toFixed(1) || '0.0'}</td>
                  <td className="py-2 text-gray-300">{row.netPower.toFixed(1)}</td>
                  <td className="py-2 text-gray-300">€{row.cost.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
