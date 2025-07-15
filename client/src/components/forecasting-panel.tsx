import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SimulationDataPoint } from "@shared/schema";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface ForecastingPanelProps {
  data: SimulationDataPoint[];
  currentSlot: number;
}

export function ForecastingPanel({ data, currentSlot }: ForecastingPanelProps) {
  const forecastHorizon = 12; // 12 slots (3 hours ahead)
  const forecastData = data.slice(currentSlot + 1, currentSlot + 1 + forecastHorizon);

  if (forecastData.length === 0) {
    return (
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-50">Forecasting</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-400">No forecast data available</p>
        </CardContent>
      </Card>
    );
  }

  const avgPrice = forecastData.reduce((sum, d) => sum + d.consumptionPrice, 0) / forecastData.length;
  const avgConsumption = forecastData.reduce((sum, d) => sum + d.consumption, 0) / forecastData.length;
  const avgPvGeneration = forecastData.reduce((sum, d) => sum + d.pvGeneration, 0) / forecastData.length;

  const currentPrice = data[currentSlot]?.consumptionPrice || 0;
  const currentConsumption = data[currentSlot]?.consumption || 0;
  const currentPvGeneration = data[currentSlot]?.pvGeneration || 0;

  const priceDirection = avgPrice > currentPrice ? 'up' : avgPrice < currentPrice ? 'down' : 'stable';
  const consumptionDirection = avgConsumption > currentConsumption ? 'up' : avgConsumption < currentConsumption ? 'down' : 'stable';
  const pvDirection = avgPvGeneration > currentPvGeneration ? 'up' : avgPvGeneration < currentPvGeneration ? 'down' : 'stable';

  const DirectionIcon = ({ direction }: { direction: string }) => {
    switch (direction) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-red-400" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-green-400" />;
      default:
        return <Minus className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-50">
          Forecasting (Next 3 Hours)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3">
          <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
            <div className="flex items-center space-x-3">
              <DirectionIcon direction={priceDirection} />
              <div>
                <p className="text-sm font-medium text-gray-200">Price Forecast</p>
                <p className="text-xs text-gray-400">Average: €{avgPrice.toFixed(3)}/kWh</p>
              </div>
            </div>
            <span className="text-sm text-amber-400">
              {priceDirection === 'up' ? '+' : priceDirection === 'down' ? '-' : '='}{Math.abs(avgPrice - currentPrice).toFixed(3)}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
            <div className="flex items-center space-x-3">
              <DirectionIcon direction={consumptionDirection} />
              <div>
                <p className="text-sm font-medium text-gray-200">Consumption Forecast</p>
                <p className="text-xs text-gray-400">Average: {avgConsumption.toFixed(1)} kW</p>
              </div>
            </div>
            <span className="text-sm text-red-400">
              {consumptionDirection === 'up' ? '+' : consumptionDirection === 'down' ? '-' : '='}{Math.abs(avgConsumption - currentConsumption).toFixed(1)}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
            <div className="flex items-center space-x-3">
              <DirectionIcon direction={pvDirection} />
              <div>
                <p className="text-sm font-medium text-gray-200">PV Generation Forecast</p>
                <p className="text-xs text-gray-400">Average: {avgPvGeneration.toFixed(1)} kW</p>
              </div>
            </div>
            <span className="text-sm text-emerald-400">
              {pvDirection === 'up' ? '+' : pvDirection === 'down' ? '-' : '='}{Math.abs(avgPvGeneration - currentPvGeneration).toFixed(1)}
            </span>
          </div>
        </div>

        <div className="mt-4 p-3 bg-gray-700 rounded-lg">
          <h4 className="text-sm font-medium text-gray-200 mb-2">Next Hour Outlook</h4>
          <div className="grid grid-cols-4 gap-2 text-xs">
            {forecastData.slice(0, 4).map((slot, idx) => (
              <div key={idx} className="text-center">
                <p className="text-gray-400">{slot.timeString}</p>
                <p className="text-amber-400">€{slot.consumptionPrice.toFixed(3)}</p>
                <p className="text-red-400">{slot.consumption.toFixed(0)}kW</p>
                <p className="text-emerald-400">{slot.pvGeneration.toFixed(0)}kW</p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}