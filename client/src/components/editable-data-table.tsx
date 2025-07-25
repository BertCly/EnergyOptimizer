import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimulationDataPoint, SiteEnergyConfig } from "@shared/schema";
import { getPvInverterGeneration, distributePvSetpoint } from "@/lib/optimization-algorithm";
import { useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface EditableDataTableProps {
  data: SimulationDataPoint[];
  onDataChange: (data: SimulationDataPoint[]) => void;
  onExportData: () => void;
  isSimulationRunning: boolean;
  config: SiteEnergyConfig;
}

export function EditableDataTable({ 
  data, 
  onDataChange, 
  onExportData, 
  isSimulationRunning,
  config
}: EditableDataTableProps) {
  const [editingCell, setEditingCell] = useState<{ row: number; field: string } | null>(null);

  const handleCellEdit = (rowIndex: number, field: string, value: string) => {
    const updatedData = [...data];
    const row = updatedData[rowIndex];
    
    if (field === 'injectionPrice') {
      const numericValue = parseFloat(value);
      if (isNaN(numericValue)) return;
      row.injectionPrice = numericValue;
    } else if (field === 'consumptionPrice') {
      const numericValue = parseFloat(value);
      if (isNaN(numericValue)) return;
      row.consumptionPrice = numericValue;
    } else if (field === 'consumption') {
      const numericValue = parseFloat(value);
      if (isNaN(numericValue)) return;
      row.consumption = numericValue;
    } else if (field === 'pvGeneration') {
      const numericValue = parseFloat(value);
      if (isNaN(numericValue)) return;
      row.pvGeneration = numericValue;
    } else if (field === 'pvForecast') {
      const numericValue = parseFloat(value);
      if (isNaN(numericValue)) return;
      row.pvForecast = numericValue;
    } else if (field === 'tradingSignal') {
      // Validate trading signal value
      if (['standby', 'local', 'overrule'].includes(value)) {
        row.tradingSignal = value as any;
      } else {
        return; // Invalid value, don't update
      }
    } else if (field === 'tradingSignalRequestedPower') {
      const numericValue = parseFloat(value);
      if (isNaN(numericValue)) return;
      row.tradingSignalRequestedPower = numericValue;
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
    value: number | string; 
    rowIndex: number; 
    field: string; 
    className: string; 
  }) => {
    const isEditing = editingCell?.row === rowIndex && editingCell?.field === field;
    
    if (isEditing) {
      return (
        <Input
          type={typeof value === 'number' ? 'number' : 'text'}
          step="0.001"
          defaultValue={typeof value === 'number' ? value.toFixed(3) : value}
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
        {typeof value === 'number' 
          ? value.toFixed(field === 'injectionPrice' || field === 'consumptionPrice' ? 0 : 1)
          : value
        }
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
                <th className="pb-3 text-gray-300 font-medium">Consumptie Cost (€/MWh)</th>
                <th className="pb-3 text-gray-300 font-medium">Injectie Cost (€/MWh)</th>
                <th className="pb-3 text-gray-300 font-medium">Consumption (kW)</th>
                <th className="pb-3 text-gray-300 font-medium">Raw PV Generation (kW)</th>
                <th className="pb-3 text-gray-300 font-medium">Trading Signal</th>
                <th className="pb-3 text-gray-300 font-medium">Battery Power (kW)</th>
                <th className="pb-3 text-gray-300 font-medium">SoC (%)</th>
                <th className="pb-3 text-gray-300 font-medium">Extra load</th>
                <th className="pb-3 text-gray-300 font-medium">PV Generation (kW)</th>
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
                      value={row.consumptionPrice}
                      rowIndex={index}
                      field="consumptionPrice"
                      className="text-orange-400"
                    />
                  </td>
                  <td className="py-2">
                    <EditableCell
                      value={row.injectionPrice}
                      rowIndex={index}
                      field="injectionPrice"
                      className="text-amber-400"
                    />
                  </td>
                  <td className="py-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help">
                          <EditableCell
                            value={row.consumption}
                            rowIndex={index}
                            field="consumption"
                            className="text-red-400"
                          />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div>Consumption Forecast: {row.pvForecast?.toFixed(1) || '0.0'} kW</div>
                      </TooltipContent>
                    </Tooltip>
                  </td>
                  <td className="py-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help">
                          <EditableCell
                            value={row.pvGeneration}
                            rowIndex={index}
                            field="pvGeneration"
                            className="text-emerald-400"
                          />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div>Raw PV Generation: {row.pvGeneration?.toFixed(1) || '0.0'} kW</div>
                        <div>Actual PV Generation: {row.actualPvGeneration?.toFixed(1) || '0.0'} kW</div>
                        <div>PV Forecast: {row.pvForecast?.toFixed(1) || '0.0'} kW</div>
                      </TooltipContent>
                    </Tooltip>
                  </td>
                  <td className="py-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help">
                          <EditableCell
                            value={row.tradingSignal}
                            rowIndex={index}
                            field="tradingSignal"
                            className="text-cyan-400 uppercase font-medium"
                          />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div>Requested Power: {row.tradingSignalRequestedPower?.toFixed(1) || '0.0'} kW</div>
                      </TooltipContent>
                    </Tooltip>
                  </td>
                  <td className="py-2 text-blue-400">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help">{row.batteryPower.toFixed(1)}</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div dangerouslySetInnerHTML={{ 
                          __html: row.batteryDecisionReason
                        }} />
                      </TooltipContent>
                    </Tooltip>
                  </td>
                  <td className="py-2 text-purple-400">{row.soc.toFixed(1)}</td>
                  <td className="py-2 text-orange-400">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help">{row.loadState ? 'ON' : 'OFF'}</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div dangerouslySetInnerHTML={{ 
                          __html: row.loadDecisionReason
                        }} />
                      </TooltipContent>
                    </Tooltip>
                  </td>
                  <td className="py-2 text-pink-400">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help">
                          {row.actualPvGeneration?.toFixed(1) || '0.0'}
                          {(row.pvActivePowerSetpoint || 0) < config.pvInverters.reduce((sum, inverter) => sum + inverter.capacity, 0) && (
                            <span className="text-xs text-orange-400 ml-1">- curtailed</span>
                          )}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                      <div className="mb-2 pb-2 border-b border-gray-600">
                        <div dangerouslySetInnerHTML={{ 
                            __html: row.curtailmentDecisionReason || 'No PV setpoint reason available'
                          }} />
                        </div>
                        <div>Actual PV Generation: {row.actualPvGeneration?.toFixed(1) || '0.0'} kW</div>
                        <div>PV Generation without curtailment: {row.pvGeneration?.toFixed(1) || '0.0'} kW</div>
                        <div>PV Power Setpoint: {row.pvActivePowerSetpoint?.toFixed(1) || '0.0'} kW</div>
                        <div className="mb-2  mt-2 pt-2 border-t border-gray-600">
                          <div className="text-xs font-medium mb-1">Per Inverter:</div>
                          {config.pvInverters.map(inverter => {
                            const generation = getPvInverterGeneration(row, inverter.id);
                            const { inverterSetpoints } = distributePvSetpoint(row, config, row.pvActivePowerSetpoint || 0);
                            const setpoint = inverterSetpoints.get(inverter.id) || 0;
                            const actualGeneration = Math.min(setpoint, generation);
                            return (
                              <div key={inverter.id} className="text-xs text-gray-300">
                                <span className={inverter.controllable ? 'text-blue-400' : 'text-gray-400'}>
                                  {inverter.controllable ? '●' : '○'} {inverter.id}:
                                </span>
                                <span className="ml-1">
                                  {actualGeneration.toFixed(1)}/{setpoint.toFixed(1)}/{inverter.capacity.toFixed(1)} kW
                                </span>
                                <span className="text-xs text-gray-500 ml-1">
                                  (actual/setpoint/capacity)
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        
                      </TooltipContent>
                    </Tooltip>
                  </td>
                  <td className="py-2 text-gray-300">{row.netPower.toFixed(1)}</td>
                  <td className="py-2 text-gray-300">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help">€{row.cost.toFixed(3)}</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {`${row.netPower.toFixed(1)} kW * €${(row.netPower >= 0 ? row.consumptionPrice : row.injectionPrice).toFixed(0)}/MWh * 0.25h`}
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