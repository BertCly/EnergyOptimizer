import { SimulationDataPoint, SiteEnergyConfig, PvInverterGeneration } from "@shared/schema";

export type SimulationScenario =
  | 'eveningHighPrice'
  | 'negativeDayPrice'
  | 'variablePv'
  | 'startupPeak'
  | 'lowPv'
  | 'priceSpike'
  | 'random';

export function generateSimulationData(config: SiteEnergyConfig, scenario: SimulationScenario, slots: number = 48): SimulationDataPoint[] {
  const data: SimulationDataPoint[] = [];
  const startTime = new Date();
  startTime.setHours(8, 0, 0, 0); // Start at 8:00 AM

  // Generate base consumption prices based on time of day
  const getBaseConsumptionPrice = (hour: number): number => {
    // Nighttime (22:00 - 06:00): ~120€/MWh
    if (hour >= 22 || hour <= 6) {
      return 120 + (Math.random() - 0.5) * 20; // 110-130€/MWh
    }
    // Daytime (07:00 - 21:00): ~170€/MWh (no evening peak for default scenarios)
    else if (hour >= 7 && hour <= 21) {
      return 170 + (Math.random() - 0.5) * 30; // 155-185€/MWh
    }
    // Late evening (22:00+): same as nighttime
    else {
      return 120 + (Math.random() - 0.5) * 20; // 110-130€/MWh
    }
  };

  const priceSchedule: Record<number, { injection: number; consumption: number }> = {};

  if (scenario === 'eveningHighPrice') {
    // Evening peak scenario with very high prices
    for (let h = 18; h <= 23; h++) {
      const consumptionPrice = 450 + (Math.random() - 0.5) * 100; // 400-500€/MWh
      priceSchedule[h] = { 
        injection: consumptionPrice - 120, 
        consumption: consumptionPrice 
      };
    }
  } else if (scenario === 'negativeDayPrice') {
    // Negative prices during daytime (excess solar)
    for (let h = 9; h <= 16; h++) {
      const consumptionPrice = -50 + (Math.random() - 0.5) * 30; // -65 to -35€/MWh
      priceSchedule[h] = { 
        injection: consumptionPrice - 120, 
        consumption: consumptionPrice 
      };
    }
  } else if (scenario === 'priceSpike') {
    // Normal prices for most hours
    for (let h = 0; h < 24; h++) {
      const basePrice = getBaseConsumptionPrice(h);
      priceSchedule[h] = { 
        injection: basePrice - 120, 
        consumption: basePrice 
      };
    }
    // Very high prices for a short period (12:00-14:00)
    for (let h = 12; h <= 13; h++) {
      const consumptionPrice = 600 + (Math.random() - 0.5) * 100; // 550-650€/MWh
      priceSchedule[h] = { 
        injection: consumptionPrice - 120, 
        consumption: consumptionPrice 
      };
    }
  } else if (scenario === 'random') {
    // Random prices with realistic ranges
    for (let h = 0; h < 24; h++) {
      const basePrice = getBaseConsumptionPrice(h);
      const variation = (Math.random() - 0.5) * 100; // ±50€/MWh variation
      const consumptionPrice = Math.max(0, basePrice + variation);
      priceSchedule[h] = {
        injection: Math.max(0, consumptionPrice - 120),
        consumption: consumptionPrice
      };
    }
  } else {
    // Default scenario: realistic price curve
    for (let h = 0; h < 24; h++) {
      const basePrice = getBaseConsumptionPrice(h);
      priceSchedule[h] = { 
        injection: basePrice - 120, 
        consumption: basePrice 
      };
    }
  }

  // Ensure all hours have prices set (for scenarios that don't set all hours)
  for (let h = 0; h < 24; h++) {
    if (!priceSchedule[h]) {
      const basePrice = getBaseConsumptionPrice(h);
      priceSchedule[h] = { 
        injection: basePrice - 120, 
        consumption: basePrice 
      };
    }
  }

  for (let i = 0; i < slots; i++) {
    const time = new Date(startTime.getTime() + i * 15 * 60 * 1000);
    const hour = time.getHours();

    const pricePair = priceSchedule[hour];
    const injectionPrice = pricePair.injection; // €/MWh
    const consumptionPrice = pricePair.consumption; // €/MWh

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

    // PV generation pattern (10:00-16:00) - per inverter
    let totalPvGeneration = 0;
    let totalPvForecast = 0;
    const pvInverterGenerations: PvInverterGeneration[] = [];

    if (hour >= 10 && hour <= 16) {
      const midDay = 13;
      const distanceFromPeak = Math.abs(hour - midDay);
      const solarFactor = Math.max(0, 1 - distanceFromPeak / 3);

      // Generate per inverter
      for (const inverter of config.pvInverters) {
        let maxGeneration = inverter.capacity;
        
        // Apply scenario-specific modifications
        if (scenario === 'variablePv') {
          maxGeneration = Math.min(inverter.capacity, 20 + Math.random() * 30);
        } else if (scenario === 'lowPv') {
          maxGeneration = Math.min(inverter.capacity, 15);
        }

        // Calculate generation with some randomness
        const baseGeneration = maxGeneration * solarFactor;
        const randomVariation = Math.random() * 2 - 1; // -1 to +1 kW
        const generation = Math.max(0, Math.min(baseGeneration + randomVariation, inverter.capacity));
        
        const forecast = Math.max(0, Math.min(baseGeneration + 0.5, inverter.capacity)); // Slightly optimistic forecast

        pvInverterGenerations.push({
          inverterId: inverter.id,
          generation: generation
        });

        totalPvGeneration += generation;
        totalPvForecast += forecast;
      }
    }

    data.push({
      time,
      timeString: time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      injectionPrice,
      consumptionPrice,
      consumption,
      pvGeneration: totalPvGeneration,
      pvForecast: totalPvForecast,
      pvInverterGenerations,
      batteryPower: 0,
      soc: config.initialSoc,
      netPower: 0,
      cost: 0,
      curtailment: 0,
      loadState: false,
      loadDecisionReason: '',
      batteryDecisionReason: '',
      curtailmentDecisionReason: '',
    });
  }

  return data;
}
