import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimulationDataPoint } from "@shared/schema";
import { useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface EditableDataTableProps {
  data: SimulationDataPoint[];
  onDataChange: (data: SimulationDataPoint[]) => void;
  onClearLog: () => void;
  onExportData: () => void;
  isSimulationRunning: boolean;
}

export function EditableDataTable({ 
  data, 
  onDataChange, 
  onClearLog, 
  onExportData, 
  isSimulationRunning 
}: EditableDataTableProps) {
  const [editingCell, setEditingCell] = useState<{ row: number; field: string } | null>(null);

  const handleCellEdit = (rowIndex: number, field: string, value: string) => {
    const numericValue = parseFloat(value);
    if (isNaN(numericValue)) return;

    const updatedData = [...data];
    const row = updatedData[rowIndex];
    
    if (field === 'injectionPrice') {
      row.injectionPrice = numericValue;
    } else if (field === 'consumptionPrice') {
      row.consumptionPrice = numericValue;
    } else if (field === 'consumption') {
      row.consumption = numericValue;
    } else if (field === 'pvGeneration') {
      row.pvGeneration = numericValue;
    } else if (field === 'pvForecast') {
      row.pvForecast = numericValue;
    }

    onDataChange(updatedData);
    setEditingCell(null);
  };

  const handleCellClick = (rowIndex: number, field: string) => {
    if (!isSimulationRunning) {
      setEditingCell({ row: rowIndex, field });
    }
  };

  const EditableCell = ({ 
    value, 
    rowIndex, 
    field, 
    className 
  }: { 
    value: number; 
    rowIndex: number; 
    field: string; 
    className: string; 
  }) => {
    const isEditing = editingCell?.row === rowIndex && editingCell?.field === field;
    
    if (isEditing) {
      return (
        <Input
          type="number"
          step="0.001"
          defaultValue={value.toFixed(3)}
          autoFocus
          className="w-20 h-6 px-1 py-0 text-xs bg-gray-600 border-gray-500"
          onBlur={(e) => handleCellEdit(rowIndex, field, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleCellEdit(rowIndex, field, e.currentTarget.value);
            } else if (e.key === 'Escape') {
              setEditingCell(null);
            }
          }}
        />
      );
    }

    return (
      <span
        className={`${className} cursor-pointer hover:bg-gray-600 px-1 py-0.5 rounded ${
          !isSimulationRunning ? 'hover:outline hover:outline-1 hover:outline-blue-400' : ''
        }`}
        onClick={() => handleCellClick(rowIndex, field)}
        title={!isSimulationRunning ? "Click to edit" : "Stop simulation to edit"}
      >
        {value.toFixed(field === 'injectionPrice' || field === 'consumptionPrice' ? 3 : 1)}
      </span>
    );
  };

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-50">
            Simulation Data {!isSimulationRunning && <span className="text-sm text-blue-400">(Click values to edit)</span>}
          </CardTitle>
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
        <div className="overflow-x-auto max-h-[40rem]">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-700 sticky top-0 bg-gray-800">
              <tr className="text-left">
                <th className="pb-3 text-gray-300 font-medium">Time</th>
                <th className="pb-3 text-gray-300 font-medium">Injectie Cost (€/kWh)</th>
                <th className="pb-3 text-gray-300 font-medium">Consumptie Cost (€/kWh)</th>
                <th className="pb-3 text-gray-300 font-medium">Consumption (kW)</th>
                <th className="pb-3 text-gray-300 font-medium">PV Generation (kW)</th>
                <th className="pb-3 text-gray-300 font-medium">PV Forecast (kW)</th>
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
              {data.map((row, index) => (
                <tr key={index} className="border-b border-gray-700">
                  <td className="py-2 text-gray-300">{row.timeString}</td>
                  <td className="py-2">
                    <EditableCell
                      value={row.injectionPrice}
                      rowIndex={index}
                      field="injectionPrice"
                      className="text-amber-400"
                    />
                  </td>
                  <td className="py-2">
                    <EditableCell
                      value={row.consumptionPrice}
                      rowIndex={index}
                      field="consumptionPrice"
                      className="text-orange-400"
                    />
                  </td>
                  <td className="py-2">
                    <EditableCell
                      value={row.consumption}
                      rowIndex={index}
                      field="consumption"
                      className="text-red-400"
                    />
                  </td>
                  <td className="py-2">
                    <EditableCell
                      value={row.pvGeneration}
                      rowIndex={index}
                      field="pvGeneration"
                      className="text-emerald-400"
                    />
                  </td>
                  <td className="py-2">
                    <EditableCell
                      value={row.pvForecast}
                      rowIndex={index}
                      field="pvForecast"
                      className="text-emerald-300"
                    />
                  </td>
                  <td className="py-2 text-blue-400">{row.batteryPower.toFixed(1)}</td>
                  <td className="py-2 text-purple-400">{row.soc.toFixed(1)}</td>
                  <td className="py-2 text-cyan-400">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help">{row.batteryDecision || 'hold'}</span>
                      </TooltipTrigger>
                      <TooltipContent>{row.batteryDecisionReason}</TooltipContent>
                    </Tooltip>
                  </td>
                  <td className="py-2 text-orange-400">{row.loadState ? 'ON' : 'OFF'}</td>
                  <td className="py-2 text-pink-400">{row.curtailment?.toFixed(1) || '0.0'}</td>
                  <td className="py-2 text-gray-300">{row.netPower.toFixed(1)}</td>
                  <td className="py-2 text-gray-300">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help">€{row.cost.toFixed(3)}</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {`${row.netPower.toFixed(1)} kW * €${(row.netPower >= 0 ? row.consumptionPrice : row.injectionPrice).toFixed(3)} * 0.25h`}
                      </TooltipContent>
                    </Tooltip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}