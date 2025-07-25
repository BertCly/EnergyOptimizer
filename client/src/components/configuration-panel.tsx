import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Info, ChevronDown, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { SiteEnergyConfig, PvInverter } from "@shared/schema";

import { SimulationScenario } from "@/lib/data-generator";

interface ConfigurationPanelProps {
  config: SiteEnergyConfig;
  onConfigChange: (config: SiteEnergyConfig) => void;
  scenario: SimulationScenario;
  onScenarioChange: (s: SimulationScenario) => void;
}

export function ConfigurationPanel({ config, onConfigChange, scenario, onScenarioChange }: ConfigurationPanelProps) {
  const [openScenario, setOpenScenario] = useState(true)
  const [openBattery, setOpenBattery] = useState(false)
  const [openLimits, setOpenLimits] = useState(false)
  const [openLoad, setOpenLoad] = useState(false)
  const [openGrid, setOpenGrid] = useState(false)
  const [openPv, setOpenPv] = useState(false)
  const [openTrading, setOpenTrading] = useState(false)

  const updateConfig = (field: keyof SiteEnergyConfig, value: number | string | boolean) => {
    onConfigChange({
      ...config,
      [field]: value,
    });
  };

  const addPvInverter = () => {
    const newInverter: PvInverter = {
      id: `pv-${Date.now()}`,
      capacity: 10,
      controllable: true,
    };
    onConfigChange({
      ...config,
      pvInverters: [...config.pvInverters, newInverter],
    });
  };

  const removePvInverter = (id: string) => {
    onConfigChange({
      ...config,
      pvInverters: config.pvInverters.filter(inverter => inverter.id !== id),
    });
  };

  const updatePvInverter = (id: string, field: keyof PvInverter, value: number | string | boolean | null) => {
    onConfigChange({
      ...config,
      pvInverters: config.pvInverters.map(inverter => 
        inverter.id === id ? { ...inverter, [field]: value } : inverter
      ),
    });
  };

  return (
    <div className="space-y-6">
      {/* Scenario block is always visible, not collapsible */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-50">Scenario</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            className="mt-1 bg-gray-700 border-gray-600 text-gray-50 w-full"
            value={scenario}
            onChange={e => onScenarioChange(e.target.value as SimulationScenario)}
          >
            <option value="eveningHighPrice">Evening high prices</option>
            <option value="negativeDayPrice">Negative day prices</option>
            <option value="variablePv">Variable PV</option>
            <option value="startupPeak">Workday startup peak</option>
            <option value="lowPv">Low PV yield</option>
            <option value="priceSpike">Price spike (12:00-14:00)</option>
            <option value="random">Random</option>
          </select>
        </CardContent>
      </Card>

      {/* Optimization Strategy Selection */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-50">Optimization Strategy</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex items-center space-x-2">
                <Label htmlFor="optimizationStrategy" className="text-sm font-medium text-gray-300">
                  Strategy
                </Label>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-4 h-4 text-gray-400" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    <div className="space-y-2">
                      <p className="font-medium">Optimization Strategy</p>
                      <div className="space-y-1 text-sm">
                        <p><strong>Cost Optimization:</strong> Uses electricity prices to minimize costs. Charges during low prices, discharges during high prices, and optimizes load scheduling.</p>
                        <p><strong>Peak Shaving:</strong> Uses grid power thresholds to smooth consumption peaks. Discharges when grid power is high, charges when grid power is low.</p>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>
              <select
                id="optimizationStrategy"
                className="mt-1 bg-gray-700 border-gray-600 text-gray-50 w-full"
                value={config.optimizationStrategy}
                onChange={e => updateConfig('optimizationStrategy', e.target.value)}
              >
                <option value="cost_optimization">Cost Optimization</option>
                <option value="peak_shaving">Peak Shaving</option>
              </select>
            </div>



            {/* Peak Shaving Configuration - only show when peak shaving strategy is selected */}
            {config.optimizationStrategy === "peak_shaving" && (
              <div className="space-y-4 pt-4 border-t border-gray-600">
                <h4 className="text-sm font-medium text-gray-300">Peak Shaving Thresholds</h4>
                
                <div>
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="peakShavingDischargeStart" className="text-sm font-medium text-gray-300">
                      Start Discharge Above (kW)
                    </Label>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="w-4 h-4 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Above this grid power, the storage will discharge to level off grid power to this threshold</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    id="peakShavingDischargeStart"
                    type="number"
                    min="0"
                    max="1000"
                    value={config.peakShavingDischargeStart}
                    onChange={(e) => updateConfig('peakShavingDischargeStart', parseFloat(e.target.value))}
                    className="mt-1 bg-gray-700 border-gray-600 text-gray-50 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="peakShavingDischargeStop" className="text-sm font-medium text-gray-300">
                      Stop Discharging Below (kW)
                    </Label>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="w-4 h-4 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>When discharging, stop as soon as grid power drops below this threshold</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    id="peakShavingDischargeStop"
                    type="number"
                    min="0"
                    max="1000"
                    value={config.peakShavingDischargeStop}
                    onChange={(e) => updateConfig('peakShavingDischargeStop', parseFloat(e.target.value))}
                    className="mt-1 bg-gray-700 border-gray-600 text-gray-50 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="peakShavingChargeStop" className="text-sm font-medium text-gray-300">
                      Stop Charging Above (kW)
                    </Label>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="w-4 h-4 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>When charging, stop as soon as grid power rises above this threshold. Negative values mean the system is exporting power to the grid.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    id="peakShavingChargeStop"
                    type="number"
                    min="-1000"
                    max="1000"
                    value={config.peakShavingChargeStop}
                    onChange={(e) => updateConfig('peakShavingChargeStop', parseFloat(e.target.value))}
                    className="mt-1 bg-gray-700 border-gray-600 text-gray-50 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="peakShavingChargeStart" className="text-sm font-medium text-gray-300">
                      Start Charging Below (kW)
                    </Label>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="w-4 h-4 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Below this grid power, the storage will charge to level off grid power to this threshold. Negative values mean the system is exporting power to the grid.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    id="peakShavingChargeStart"
                    type="number"
                    min="-1000"
                    max="1000"
                    value={config.peakShavingChargeStart}
                    onChange={(e) => updateConfig('peakShavingChargeStart', parseFloat(e.target.value))}
                    className="mt-1 bg-gray-700 border-gray-600 text-gray-50 focus:ring-500"
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Collapsible open={openTrading} onOpenChange={setOpenTrading}>
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-gray-50">Trading Signal Integration</CardTitle>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" className="text-gray-400">
                <ChevronDown className={cn("h-4 w-4 transition-transform", openTrading ? "rotate-180" : "")} />
              </Button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center space-x-2">
                  <Label htmlFor="tradingSignalEnabled" className="text-sm font-medium text-gray-300">
                    Enable Trading Signal
                  </Label>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="w-4 h-4 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">
                      <div className="space-y-2">
                        <p className="font-medium">Trading Signal Integration</p>
                        <div className="space-y-1 text-sm">
                          <p>Enable integration with external trading partners (Yuso, Centrica, Trevi) for energy market participation.</p>
                          <p><strong>Note:</strong> When enabled, trading signals take priority over local optimization algorithms.</p>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <select
                  id="tradingSignalEnabled"
                  className="mt-1 bg-gray-700 border-gray-600 text-gray-50 w-full"
                  value={config.tradingSignalEnabled ? "true" : "false"}
                  onChange={e => updateConfig('tradingSignalEnabled', e.target.value === "true")}
                >
                  <option value="false">Disabled</option>
                  <option value="true">Enabled</option>
                </select>
              </div>

            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible open={openPv} onOpenChange={setOpenPv}>
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-gray-50">PV Inverters</CardTitle>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" className="text-gray-400">
                <ChevronDown className={cn("h-4 w-4 transition-transform", openPv ? "rotate-180" : "")} />
              </Button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              {config.pvInverters.map((inverter, index) => (
                <div key={inverter.id} className="p-4 border border-gray-600 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-gray-300">PV Inverter {index + 1}</h4>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removePvInverter(inverter.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <div>
                    <div className="flex items-center space-x-2">
                      <Label htmlFor={`capacity-${inverter.id}`} className="text-sm font-medium text-gray-300">
                        Capacity (kW)
                      </Label>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="w-4 h-4 text-gray-400" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Maximum power output of the PV inverter</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Input
                      id={`capacity-${inverter.id}`}
                      type="number"
                      min="1"
                      max="1000"
                      step="1"
                      value={inverter.capacity}
                      onChange={(e) => updatePvInverter(inverter.id, 'capacity', parseInt(e.target.value))}
                      className="mt-1 bg-gray-700 border-gray-600 text-gray-50 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center space-x-2">
                      <Label htmlFor={`price-${inverter.id}`} className="text-sm font-medium text-gray-300">
                        Price per MWh (optional)
                      </Label>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="w-4 h-4 text-gray-400" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Optional price per MWh for this inverter's output</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Input
                      id={`price-${inverter.id}`}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Leave empty for no price"
                      value={inverter.pricePerMWh || ''}
                      onChange={(e) => updatePvInverter(inverter.id, 'pricePerMWh', e.target.value ? parseFloat(e.target.value) : null)}
                      className="mt-1 bg-gray-700 border-gray-600 text-gray-50 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center space-x-2">
                      <Label htmlFor={`controllable-${inverter.id}`} className="text-sm font-medium text-gray-300">
                        Controllable
                      </Label>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="w-4 h-4 text-gray-400" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Whether this inverter can be controlled/curtailed by the optimization algorithm</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <select
                      id={`controllable-${inverter.id}`}
                      className="mt-1 bg-gray-700 border-gray-600 text-gray-50 w-full"
                      value={inverter.controllable ? "true" : "false"}
                      onChange={(e) => updatePvInverter(inverter.id, 'controllable', e.target.value === "true")}
                    >
                      <option value="true">Controllable</option>
                      <option value="false">Non-controllable</option>
                    </select>
                  </div>
                </div>
              ))}

              <Button
                onClick={addPvInverter}
                variant="outline"
                className="w-full border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add PV Inverter
              </Button>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible open={openBattery} onOpenChange={setOpenBattery}>
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-gray-50">Battery Configuration</CardTitle>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" className="text-gray-400">
                <ChevronDown className={cn("h-4 w-4 transition-transform", openBattery ? "rotate-180" : "")} />
              </Button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4">
          <div>
            <div className="flex items-center space-x-2">
              <Label htmlFor="batteryCapacity" className="text-sm font-medium text-gray-300">
                Battery Capacity (kWh)
              </Label>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-4 h-4 text-gray-400" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Total energy storage capacity of the battery system</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Input
              id="batteryCapacity"
              type="number"
              min="10"
              max="1000"
              value={config.batteryCapacity}
              onChange={(e) => updateConfig('batteryCapacity', parseFloat(e.target.value))}
              className="mt-1 bg-gray-700 border-gray-600 text-gray-50 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <Label htmlFor="maxChargeRate" className="text-sm font-medium text-gray-300">
                Max Charge Rate (kW)
              </Label>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-4 h-4 text-gray-400" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Maximum power the battery can accept while charging</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Input
              id="maxChargeRate"
              type="number"
              min="1"
              max="1000"
              value={config.maxChargeRate}
              onChange={(e) => updateConfig('maxChargeRate', parseFloat(e.target.value))}
              className="mt-1 bg-gray-700 border-gray-600 text-gray-50 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <Label htmlFor="maxDischargeRate" className="text-sm font-medium text-gray-300">
                Max Discharge Rate (kW)
              </Label>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-4 h-4 text-gray-400" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Maximum power the battery can provide while discharging</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Input
              id="maxDischargeRate"
              type="number"
              min="1"
              max="500"
              value={config.maxDischargeRate}
              onChange={(e) => updateConfig('maxDischargeRate', parseFloat(e.target.value))}
              className="mt-1 bg-gray-700 border-gray-600 text-gray-50 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <Label htmlFor="initialSoc" className="text-sm font-medium text-gray-300">
                Initial SoC (%)
              </Label>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-4 h-4 text-gray-400" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Starting state of charge when simulation begins</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Input
              id="initialSoc"
              type="number"
              min="0"
              max="100"
              value={config.initialSoc}
              onChange={(e) => updateConfig('initialSoc', parseFloat(e.target.value))}
              className="mt-1 bg-gray-700 border-gray-600 text-gray-50 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <Label htmlFor="minSoc" className="text-sm font-medium text-gray-300">
                Min SoC (%)
              </Label>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-4 h-4 text-gray-400" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Minimum state of charge to preserve battery health</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Input
              id="minSoc"
              type="number"
              min="0"
              max="100"
              value={config.minSoc}
              onChange={(e) => updateConfig('minSoc', parseFloat(e.target.value))}
              className="mt-1 bg-gray-700 border-gray-600 text-gray-50 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <Label htmlFor="maxSoc" className="text-sm font-medium text-gray-300">
                Max SoC (%)
              </Label>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-4 h-4 text-gray-400" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Maximum state of charge to preserve battery health</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Input
              id="maxSoc"
              type="number"
              min="0"
              max="100"
              value={config.maxSoc}
              onChange={(e) => updateConfig('maxSoc', parseFloat(e.target.value))}
              className="mt-1 bg-gray-700 border-gray-600 text-gray-50 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <Label htmlFor="batteryRoundTripEfficiency" className="text-sm font-medium text-gray-300">
                Round-trip Efficiency (%)
              </Label>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-4 h-4 text-gray-400" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Battery efficiency from charge to discharge (energy loss during round-trip)</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Input
              id="batteryRoundTripEfficiency"
              type="number"
              min="10"
              max="100"
              step="1"
              value={Math.round(config.batteryRoundTripEfficiency * 100)}
              onChange={(e) => updateConfig('batteryRoundTripEfficiency', parseFloat(e.target.value) / 100)}
              className="mt-1 bg-gray-700 border-gray-600 text-gray-50 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <Label htmlFor="batteryMinPriceDifference" className="text-sm font-medium text-gray-300">
                Min Price Difference (EUR/MWh)
              </Label>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-4 h-4 text-gray-400" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Minimum price difference required to justify battery wear and tear</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Input
              id="batteryMinPriceDifference"
              type="number"
              min="0"
              max="1000"
              step="1"
              value={config.batteryMinPriceDifference}
              onChange={(e) => updateConfig('batteryMinPriceDifference', parseFloat(e.target.value))}
              className="mt-1 bg-gray-700 border-gray-600 text-gray-50 focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible open={openLoad} onOpenChange={setOpenLoad}>
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-gray-50">Controllable load</CardTitle>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" className="text-gray-400">
                <ChevronDown className={cn("h-4 w-4 transition-transform", openLoad ? "rotate-180" : "")} />
              </Button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4">
          <div>
            <div className="flex items-center space-x-2">
              <Label htmlFor="loadActivationPower" className="text-sm font-medium text-gray-300">
                Activation Power (kW)
              </Label>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-4 h-4 text-gray-400" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Minimum PV surplus required to enable the load</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Input
              id="loadActivationPower"
              type="number"
              min="0"
              value={config.loadActivationPower}
              onChange={(e) => updateConfig('loadActivationPower', parseFloat(e.target.value))}
              className="mt-1 bg-gray-700 border-gray-600 text-gray-50 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <Label htmlFor="loadNominalPower" className="text-sm font-medium text-gray-300">
                Nominal Power (kW)
              </Label>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-4 h-4 text-gray-400" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Power consumed when the load is active</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Input
              id="loadNominalPower"
              type="number"
              min="0"
              value={config.loadNominalPower}
              onChange={(e) => updateConfig('loadNominalPower', parseFloat(e.target.value))}
              className="mt-1 bg-gray-700 border-gray-600 text-gray-50 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <Label htmlFor="loadMinRuntimeActivation" className="text-sm font-medium text-gray-300">
                Min Runtime per Activation (h)
              </Label>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-4 h-4 text-gray-400" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Minimum time the load must remain active once started</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Input
              id="loadMinRuntimeActivation"
              type="number"
              min="0"
              step="0.25"
              value={config.loadMinRuntimeActivation}
              onChange={(e) => updateConfig('loadMinRuntimeActivation', parseFloat(e.target.value))}
              className="mt-1 bg-gray-700 border-gray-600 text-gray-50 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <Label htmlFor="loadMinRuntimeDaily" className="text-sm font-medium text-gray-300">
                Min Runtime per Day (h)
              </Label>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-4 h-4 text-gray-400" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Required cumulative runtime each day</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Input
              id="loadMinRuntimeDaily"
              type="number"
              min="0"
              step="0.25"
              value={config.loadMinRuntimeDaily}
              onChange={(e) => updateConfig('loadMinRuntimeDaily', parseFloat(e.target.value))}
              className="mt-1 bg-gray-700 border-gray-600 text-gray-50 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <Label htmlFor="loadRuntimeDeadlineHour" className="text-sm font-medium text-gray-300">
                Runtime Deadline Hour
              </Label>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-4 h-4 text-gray-400" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Hour of the day by which the minimum runtime must be met</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Input
              id="loadRuntimeDeadlineHour"
              type="number"
              min="0"
              max="23"
              value={config.loadRuntimeDeadlineHour}
              onChange={(e) => updateConfig('loadRuntimeDeadlineHour', parseFloat(e.target.value))}
              className="mt-1 bg-gray-700 border-gray-600 text-gray-50 focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible open={openGrid} onOpenChange={setOpenGrid}>
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-gray-50">Grid Capacity</CardTitle>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" className="text-gray-400">
                <ChevronDown className={cn("h-4 w-4 transition-transform", openGrid ? "rotate-180" : "")} />
              </Button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4">
          <div>
            <div className="flex items-center space-x-2">
              <Label htmlFor="gridCapacityImportLimit" className="text-sm font-medium text-gray-300">
                Import Limit (kW)
              </Label>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-4 h-4 text-gray-400" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Maximum power that can be imported from the grid</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Input
              id="gridCapacityImportLimit"
              type="number"
              min="0"
              max="1000"
              value={config.gridCapacityImportLimit}
              onChange={(e) => updateConfig('gridCapacityImportLimit', parseFloat(e.target.value))}
              className="mt-1 bg-gray-700 border-gray-600 text-gray-50 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <Label htmlFor="gridCapacityExportLimit" className="text-sm font-medium text-gray-300">
                Export Limit (kW)
              </Label>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-4 h-4 text-gray-400" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Maximum power that can be exported to the grid</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Input
              id="gridCapacityExportLimit"
              type="number"
              min="0"
              max="1000"
              value={config.gridCapacityExportLimit}
              onChange={(e) => updateConfig('gridCapacityExportLimit', parseFloat(e.target.value))}
              className="mt-1 bg-gray-700 border-gray-600 text-gray-50 focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
