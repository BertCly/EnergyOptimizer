import { SimulationDataPoint } from "@shared/schema";

export type SimulationScenario =
  | 'eveningHighPrice'
  | 'negativeDayPrice'
  | 'variablePv'
  | 'startupPeak'
  | 'lowPv'
  | 'random';

export function generateSimulationData(initialSoc: number, scenario: SimulationScenario, slots: number = 48): SimulationDataPoint[] {
  const data: SimulationDataPoint[] = [];
  const startTime = new Date();
  startTime.setHours(8, 0, 0, 0); // Start at 8:00 AM

  const priceSchedule: Record<number, { injection: number; consumption: number }> = {};

  if (scenario === 'eveningHighPrice') {
    for (let h = 18; h <= 23; h++) {
      priceSchedule[h] = { injection: 200, consumption: 300 };
    }
  } else if (scenario === 'negativeDayPrice') {
    for (let h = 9; h <= 16; h++) {
      priceSchedule[h] = { injection: -120, consumption: -40 };
    }
  } else if (scenario === 'random') {
    for (let h = 0; h < 24; h++) {
      priceSchedule[h] = {
        injection: Math.random() * 150 - 50,
        consumption: Math.random() * 200 - 20,
      };
    }
  }

  for (let i = 0; i < slots; i++) {
    const time = new Date(startTime.getTime() + i * 15 * 60 * 1000);
    const hour = time.getHours();

    const pricePair = priceSchedule[hour] || { injection: 50, consumption: 150 };
    const injectionPrice = pricePair.injection / 1000; // €/kWh
    const consumptionPrice = pricePair.consumption / 1000; // €/kWh

    // Consumption pattern with afternoon peak
    let consumption = 15;
    if (hour >= 16 && hour <= 20) {
      consumption = 35 + Math.random() * 10;
    } else if (hour >= 7 && hour <= 9) {
      consumption = 25 + Math.random() * 5;
      if (scenario === 'startupPeak' && hour === 8) {
        consumption += 40;
      }
    } else if (hour >= 22 || hour <= 6) {
      consumption = 10 + Math.random() * 5;
    } else {
      consumption = 20 + Math.random() * 10;
    }

    // PV generation pattern (10:00-16:00)
    let pvGeneration = 0;
    let pvForecast = 0;
    if (hour >= 10 && hour <= 16) {
      const midDay = 13;
      const distanceFromPeak = Math.abs(hour - midDay);
      let maxGeneration = 40;
      if (scenario === 'variablePv') {
        maxGeneration = 20 + Math.random() * 30;
      } else if (scenario === 'lowPv') {
        maxGeneration = 15;
      }
      pvGeneration = Math.max(0, maxGeneration * (1 - distanceFromPeak / 3) + Math.random() * 5);
      pvForecast = Math.max(0, maxGeneration * (1 - distanceFromPeak / 3) + 2);
    }

    data.push({
      time,
      timeString: time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
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
      loadState: false,
      loadDecisionReason: '',
      batteryDecision: 'hold',
      batteryDecisionReason: '',
    });
  }

  return data;
}
