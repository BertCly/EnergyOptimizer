import { SimulationDataPoint } from "@shared/schema";

export function generateSimulationData(initialSoc: number): SimulationDataPoint[] {
  const data: SimulationDataPoint[] = [];
  const startTime = new Date();
  startTime.setHours(8, 0, 0, 0); // Start at 8:00 AM

  const priceSchedule: Record<number, { injection: number; consumption: number }> = {
    14: { injection: -125.34, consumption: -15.86 },
    15: { injection: -115.34, consumption: -5.86 },
    16: { injection: -19.68, consumption: 92.38 },
    17: { injection: 38.31, consumption: 155.1 },
    18: { injection: 49.07, consumption: 168.31 },
    19: { injection: 61.94, consumption: 184.04 },
    20: { injection: 75.28, consumption: 200.34 },
    21: { injection: 91.87, consumption: 220.61 },
    22: { injection: 83.15, consumption: 209.97 },
    23: { injection: 65.43, consumption: 188.31 },
  };

  for (let i = 0; i < 48; i++) {
    const time = new Date(startTime.getTime() + i * 15 * 60 * 1000);
    const hour = time.getHours();

    const pricePair = priceSchedule[hour] || { injection: 50, consumption: 150 };
    const injectionPrice = pricePair.injection / 1000; // €/kWh
    const consumptionPrice = pricePair.consumption / 1000; // €/kWh
    const price = consumptionPrice;

    // Consumption pattern with afternoon peak
    let consumption = 15; // Base consumption
    if (hour >= 16 && hour <= 20) {
      consumption = 35 + Math.random() * 10; // Afternoon/evening peak
    } else if (hour >= 7 && hour <= 9) {
      consumption = 25 + Math.random() * 5; // Morning medium
    } else if (hour >= 22 || hour <= 6) {
      consumption = 10 + Math.random() * 5; // Night low
    } else {
      consumption = 20 + Math.random() * 10; // Day normal
    }

    // PV generation pattern (10:00-16:00)
    let pvGeneration = 0;
    let pvForecast = 0;
    if (hour >= 10 && hour <= 16) {
      const midDay = 13; // Peak at 13:00
      const distanceFromPeak = Math.abs(hour - midDay);
      const maxGeneration = 40;
      // Actual PV generation (with weather variability)
      pvGeneration = Math.max(0, maxGeneration * (1 - distanceFromPeak / 3) + Math.random() * 5);
      // PV forecast (slightly more optimistic, without weather variability)
      pvForecast = Math.max(0, maxGeneration * (1 - distanceFromPeak / 3) + 2);
    }

    data.push({
      time,
      timeString: time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      price,
      injectionPrice,
      consumptionPrice,
      consumption,
      pvGeneration,
      pvForecast,
      batteryPower: 0,
      soc: initialSoc,
      netPower: 0,
      cost: 0,
      curtailment: 0,
      relayState: false,
      decision: 'hold',
    });
  }

  return data;
}
