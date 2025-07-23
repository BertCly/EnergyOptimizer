import { SimulationDataPoint, SiteEnergyConfig, PvInverterGeneration } from "@shared/schema";

export type SimulationScenario =
  | 'eveningHighPrice'
  | 'negativeDayPrice'
  | 'variablePv'
  | 'startupPeak'
  | 'lowPv'
  | 'priceSpike'
  | 'random';

/**
 * Generates trading signal data based on scenario and time
 */
function generateTradingSignalData(
  scenario: SimulationScenario, 
  hour: number, 
  slotIndex: number, 
  config: SiteEnergyConfig
): { tradingSignal: "standby" | "local" | "overrule"; tradingSignalRequestedPower: number } {
  
  // More random base trading signal pattern
  let tradingSignal: "standby" | "local" | "overrule" = "local";
  let tradingSignalRequestedPower = 0;

  // Add more randomness to all scenarios
  const randomFactor = Math.random();

  // Scenario-specific trading signal patterns with increased randomness
  switch (scenario) {
    case 'eveningHighPrice':
      // During evening peak (18-22h), trading partners might request overrule for grid stability
      if (hour >= 18 && hour <= 22) {
        if (Math.random() < 0.4 + randomFactor * 0.3) { // 40-70% chance of overrule during peak
          tradingSignal = "overrule";
          // Request discharge during peak (negative power) with more variation
          tradingSignalRequestedPower = -(15 + Math.random() * 45); // -15 to -60 kW
        } else if (Math.random() < 0.2) { // 20% chance of standby
          tradingSignal = "standby";
        }
      } else {
        // Random trading signals outside peak hours too
        if (Math.random() < 0.15) {
          tradingSignal = "overrule";
          tradingSignalRequestedPower = (Math.random() - 0.5) * 80; // -40 to +40 kW
        } else if (Math.random() < 0.1) {
          tradingSignal = "standby";
        }
      }
      break;

    case 'negativeDayPrice':
      // During negative prices, trading partners might request charging
      if (hour >= 9 && hour <= 16) {
        if (Math.random() < 0.5 + randomFactor * 0.3) { // 50-80% chance of overrule during negative prices
          tradingSignal = "overrule";
          // Request charging during negative prices (positive power) with more variation
          tradingSignalRequestedPower = 25 + Math.random() * 55; // 25 to 80 kW
        } else if (Math.random() < 0.15) {
          tradingSignal = "standby";
        }
      } else {
        // Random trading signals outside negative price hours
        if (Math.random() < 0.2) {
          tradingSignal = "overrule";
          tradingSignalRequestedPower = (Math.random() - 0.5) * 90; // -45 to +45 kW
        } else if (Math.random() < 0.1) {
          tradingSignal = "standby";
        }
      }
      break;

    case 'priceSpike':
      // During price spike (12-14h), trading partners might request discharge
      if (hour >= 12 && hour <= 14) {
        if (Math.random() < 0.6 + randomFactor * 0.3) { // 60-90% chance of overrule during spike
          tradingSignal = "overrule";
          // Request discharge during price spike (negative power) with more variation
          tradingSignalRequestedPower = -(20 + Math.random() * 50); // -20 to -70 kW
        } else if (Math.random() < 0.15) {
          tradingSignal = "standby";
        }
      } else {
        // Random trading signals outside spike hours
        if (Math.random() < 0.25) {
          tradingSignal = "overrule";
          tradingSignalRequestedPower = (Math.random() - 0.5) * 100; // -50 to +50 kW
        } else if (Math.random() < 0.12) {
          tradingSignal = "standby";
        }
      }
      break;

    case 'startupPeak':
      // During startup peak (8-9h), trading partners might request standby
      if (hour >= 8 && hour <= 9) {
        if (Math.random() < 0.3 + randomFactor * 0.2) { // 30-50% chance of standby during startup
          tradingSignal = "standby";
        } else if (Math.random() < 0.25) {
          tradingSignal = "overrule";
          tradingSignalRequestedPower = (Math.random() - 0.5) * 70; // -35 to +35 kW
        }
      } else {
        // Random trading signals outside startup hours
        if (Math.random() < 0.2) {
          tradingSignal = "overrule";
          tradingSignalRequestedPower = (Math.random() - 0.5) * 85; // -42.5 to +42.5 kW
        } else if (Math.random() < 0.15) {
          tradingSignal = "standby";
        }
      }
      break;

    case 'random':
      // Highly random trading signal patterns
      const randomValue = Math.random();
      if (randomValue < 0.6 + randomFactor * 0.2) { // 60-80% local optimization
        tradingSignal = "local";
      } else if (randomValue < 0.8 + randomFactor * 0.15) { // 20-35% overrule
        tradingSignal = "overrule";
        // Random requested power between -60 and +60 kW
        tradingSignalRequestedPower = (Math.random() - 0.5) * 120;
      } else {
        tradingSignal = "standby"; // 5-20% standby
      }
      break;

    default:
      // Default scenario: more random trading signals
      const timeRandom = Math.random();
      if (hour >= 10 && hour <= 16) {
        // During business hours, more frequent overrule requests
        if (timeRandom < 0.2 + randomFactor * 0.15) { // 20-35% chance
          tradingSignal = "overrule";
          // Random requested power with more variation
          tradingSignalRequestedPower = (Math.random() - 0.5) * 80; // -40 to +40 kW
        } else if (timeRandom < 0.25 + randomFactor * 0.1) { // 25-35% chance
          tradingSignal = "standby";
        }
      } else if (hour >= 22 || hour <= 6) {
        // During night hours, more random patterns
        if (timeRandom < 0.15 + randomFactor * 0.1) { // 15-25% chance
          tradingSignal = "standby";
        } else if (timeRandom < 0.25 + randomFactor * 0.1) { // 25-35% chance
          tradingSignal = "overrule";
          tradingSignalRequestedPower = (Math.random() - 0.5) * 60; // -30 to +30 kW
        }
      } else {
        // Other hours with random patterns
        if (timeRandom < 0.15 + randomFactor * 0.1) { // 15-25% chance
          tradingSignal = "overrule";
          tradingSignalRequestedPower = (Math.random() - 0.5) * 70; // -35 to +35 kW
        } else if (timeRandom < 0.2 + randomFactor * 0.1) { // 20-30% chance
          tradingSignal = "standby";
        }
      }
      break;
  }

  // Ensure requested power is within battery limits
  if (tradingSignal === "overrule") {
    tradingSignalRequestedPower = Math.max(
      -config.maxDischargeRate,
      Math.min(config.maxChargeRate, tradingSignalRequestedPower)
    );
  }

  return { tradingSignal, tradingSignalRequestedPower };
}

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

    // Generate trading signal data based on scenario and time
    const { tradingSignal, tradingSignalRequestedPower } = generateTradingSignalData(scenario, hour, i, config);

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
      tradingSignal,
      tradingSignalRequestedPower,
    });
  }

  return data;
}
