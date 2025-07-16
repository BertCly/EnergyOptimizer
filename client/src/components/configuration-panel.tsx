import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { BatteryConfig } from "@shared/schema";

interface ConfigurationPanelProps {
  config: BatteryConfig;
  onConfigChange: (config: BatteryConfig) => void;
}

export function ConfigurationPanel({ config, onConfigChange }: ConfigurationPanelProps) {
  const updateConfig = (field: keyof BatteryConfig, value: number) => {
    onConfigChange({
      ...config,
      [field]: value,
    });
  };

  return (
    <div className="space-y-6">
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-50">Battery Configuration</CardTitle>
        </CardHeader>
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
        </CardContent>
      </Card>

      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-50">Operating Limits</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
              <Label htmlFor="relayConsumption" className="text-sm font-medium text-gray-300">
                Relay Consumption (kW)
              </Label>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-4 h-4 text-gray-400" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Additional power consumption when relay is activated</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Input
              id="relayConsumption"
              type="number"
              min="0"
              max="1000"
              value={config.relayConsumption}
              onChange={(e) => updateConfig('relayConsumption', parseFloat(e.target.value))}
              className="mt-1 bg-gray-700 border-gray-600 text-gray-50 focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-50">Controllable load</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="relayActivationPower" className="text-sm font-medium text-gray-300">
              Activation Power (kW)
            </Label>
            <Input
              id="relayActivationPower"
              type="number"
              min="0"
              value={config.relayActivationPower}
              onChange={(e) => updateConfig('relayActivationPower', parseFloat(e.target.value))}
              className="mt-1 bg-gray-700 border-gray-600 text-gray-50 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <Label htmlFor="relayNominalPower" className="text-sm font-medium text-gray-300">
              Nominal Power (kW)
            </Label>
            <Input
              id="relayNominalPower"
              type="number"
              min="0"
              value={config.relayNominalPower}
              onChange={(e) => updateConfig('relayNominalPower', parseFloat(e.target.value))}
              className="mt-1 bg-gray-700 border-gray-600 text-gray-50 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <Label htmlFor="relayMinRuntimeActivation" className="text-sm font-medium text-gray-300">
              Min Runtime per Activation (h)
            </Label>
            <Input
              id="relayMinRuntimeActivation"
              type="number"
              min="0"
              step="0.25"
              value={config.relayMinRuntimeActivation}
              onChange={(e) => updateConfig('relayMinRuntimeActivation', parseFloat(e.target.value))}
              className="mt-1 bg-gray-700 border-gray-600 text-gray-50 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <Label htmlFor="relayMinRuntimeDaily" className="text-sm font-medium text-gray-300">
              Min Runtime per Day (h)
            </Label>
            <Input
              id="relayMinRuntimeDaily"
              type="number"
              min="0"
              step="0.25"
              value={config.relayMinRuntimeDaily}
              onChange={(e) => updateConfig('relayMinRuntimeDaily', parseFloat(e.target.value))}
              className="mt-1 bg-gray-700 border-gray-600 text-gray-50 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <Label htmlFor="relayRuntimeDeadlineHour" className="text-sm font-medium text-gray-300">
              Runtime Deadline Hour
            </Label>
            <Input
              id="relayRuntimeDeadlineHour"
              type="number"
              min="0"
              max="23"
              value={config.relayRuntimeDeadlineHour}
              onChange={(e) => updateConfig('relayRuntimeDeadlineHour', parseFloat(e.target.value))}
              className="mt-1 bg-gray-700 border-gray-600 text-gray-50 focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
