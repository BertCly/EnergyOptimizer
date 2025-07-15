import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BatteryConfig } from "@shared/schema";

interface ConfigurationPanelProps {
  config: BatteryConfig;
  onConfigChange: (config: BatteryConfig) => void;
  currentStatus: {
    soc: number;
    batteryPower: number;
    currentPrice: number;
    totalCost: number;
  };
}

export function ConfigurationPanel({ config, onConfigChange, currentStatus }: ConfigurationPanelProps) {
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
            <Label htmlFor="batteryCapacity" className="text-sm font-medium text-gray-300">
              Battery Capacity (kWh)
            </Label>
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
            <Label htmlFor="maxChargeRate" className="text-sm font-medium text-gray-300">
              Max Charge Rate (kW)
            </Label>
            <Input
              id="maxChargeRate"
              type="number"
              min="1"
              max="100"
              value={config.maxChargeRate}
              onChange={(e) => updateConfig('maxChargeRate', parseFloat(e.target.value))}
              className="mt-1 bg-gray-700 border-gray-600 text-gray-50 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <Label htmlFor="maxDischargeRate" className="text-sm font-medium text-gray-300">
              Max Discharge Rate (kW)
            </Label>
            <Input
              id="maxDischargeRate"
              type="number"
              min="1"
              max="100"
              value={config.maxDischargeRate}
              onChange={(e) => updateConfig('maxDischargeRate', parseFloat(e.target.value))}
              className="mt-1 bg-gray-700 border-gray-600 text-gray-50 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <Label htmlFor="initialSoc" className="text-sm font-medium text-gray-300">
              Initial SoC (%)
            </Label>
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
            <Label htmlFor="minSoc" className="text-sm font-medium text-gray-300">
              Min SoC (%)
            </Label>
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
            <Label htmlFor="maxSoc" className="text-sm font-medium text-gray-300">
              Max SoC (%)
            </Label>
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
            <Label htmlFor="priceThreshold" className="text-sm font-medium text-gray-300">
              Price Threshold (€/kWh)
            </Label>
            <Input
              id="priceThreshold"
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={config.priceThreshold}
              onChange={(e) => updateConfig('priceThreshold', parseFloat(e.target.value))}
              className="mt-1 bg-gray-700 border-gray-600 text-gray-50 focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-50">Current Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-300">Battery SoC</span>
            <span className="text-sm font-medium text-emerald-400">{currentStatus.soc.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-300">Battery Power</span>
            <span className="text-sm font-medium text-blue-400">{currentStatus.batteryPower.toFixed(1)} kW</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-300">Current Price</span>
            <span className="text-sm font-medium text-amber-400">€{currentStatus.currentPrice.toFixed(3)}/kWh</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-300">Total Cost</span>
            <span className="text-sm font-medium text-red-400">€{currentStatus.totalCost.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
