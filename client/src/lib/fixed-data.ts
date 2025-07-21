import { SimulationDataPoint } from "@shared/schema";

// Fixed data that won't change when configuration is adjusted
export const FIXED_SIMULATION_DATA = {
  prices: {
    0: { injection: 50, consumption: 150 },
    1: { injection: 45, consumption: 140 },
    2: { injection: 40, consumption: 130 },
    3: { injection: 35, consumption: 120 },
    4: { injection: 30, consumption: 110 },
    5: { injection: 25, consumption: 105 },
    6: { injection: -125, consumption: -16 },
    7: { injection: -115, consumption: -6 },
    8: { injection: 50, consumption: 150 },
    9: { injection: 45, consumption: 140 },
    10: { injection: 40, consumption: 130 },
    11: { injection: 35, consumption: 120 },
    12: { injection: 30, consumption: 110 },
    13: { injection: 25, consumption: 105 },
    14: { injection: -125, consumption: -16 },
    15: { injection: -115, consumption: -6 },
    16: { injection: -20, consumption: 92 },
    17: { injection: 38, consumption: 155 },
    18: { injection: 49, consumption: 168 },
    19: { injection: 62, consumption: 184 },
    20: { injection: 75, consumption: 200 },
    21: { injection: 92, consumption: 221 },
    22: { injection: 83, consumption: 210 },
    23: { injection: 65, consumption: 188 },
  },
  
  consumption: [
    20.5, 19.8, 18.2, 17.5, 16.8, 16.2, 15.9, 15.5, // 08:00-09:45
    24.2, 23.8, 22.5, 21.8, 20.9, 20.2, 19.8, 19.4, // 10:00-11:45
    18.8, 18.5, 18.2, 17.9, 17.6, 17.3, 17.0, 16.8, // 12:00-13:45
    16.5, 16.2, 15.9, 15.6, 15.3, 15.0, 14.8, 14.5, // 14:00-15:45
    38.5, 42.1, 45.2, 48.8, 52.3, 49.7, 46.8, 43.2, // 16:00-17:45
    39.8, 36.5, 33.2, 30.8, 28.5, 26.2, 24.8, 23.5, // 18:00-19:45
  ],
  
  pvGeneration: [
    0, 0, 0, 0, 0, 0, 0, 0, // 08:00-09:45
    5.2, 8.8, 12.5, 16.2, 19.8, 23.5, 27.2, 30.8, // 10:00-11:45
    34.5, 38.2, 41.8, 45.5, 42.2, 38.8, 35.5, 32.2, // 12:00-13:45
    28.8, 25.5, 22.2, 18.8, 15.5, 12.2, 8.8, 5.5, // 14:00-15:45
    2.2, 0, 0, 0, 0, 0, 0, 0, // 16:00-17:45
    0, 0, 0, 0, 0, 0, 0, 0, // 18:00-19:45
  ],
  
  pvForecast: [
    0, 0, 0, 0, 0, 0, 0, 0, // 08:00-09:45
    6.0, 9.5, 13.2, 17.0, 20.8, 24.5, 28.2, 31.8, // 10:00-11:45
    35.5, 39.2, 42.8, 46.5, 43.2, 39.8, 36.5, 33.2, // 12:00-13:45
    29.8, 26.5, 23.2, 19.8, 16.5, 13.2, 9.8, 6.5, // 14:00-15:45
    3.2, 0, 0, 0, 0, 0, 0, 0, // 16:00-17:45
    0, 0, 0, 0, 0, 0, 0, 0, // 18:00-19:45
  ]
};

export const SIMULATION_SLOTS = 96; // 24h at 15 min intervals
export const FORECAST_SLOTS = 48;   // extra 12h forecast
export const TOTAL_SLOTS = SIMULATION_SLOTS + FORECAST_SLOTS;

export function generateFixedSimulationData(
  initialSoc: number,
  totalSlots: number = TOTAL_SLOTS
): SimulationDataPoint[] {
  const data: SimulationDataPoint[] = [];
  const startTime = new Date();
  startTime.setHours(8, 0, 0, 0); // Start at 8:00 AM

  for (let i = 0; i < totalSlots; i++) {
    const time = new Date(startTime.getTime() + i * 15 * 60 * 1000);
    const hour = time.getHours();

    // Get fixed price data
    const pricePair = FIXED_SIMULATION_DATA.prices[hour as keyof typeof FIXED_SIMULATION_DATA.prices] ||
                      { injection: 50, consumption: 150 };

    data.push({
      time,
      timeString: time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      injectionPrice: pricePair.injection,
      consumptionPrice: pricePair.consumption,
      consumption: FIXED_SIMULATION_DATA.consumption[i % 48],
      pvGeneration: FIXED_SIMULATION_DATA.pvGeneration[i % 48],
      pvForecast: FIXED_SIMULATION_DATA.pvForecast[i % 48],
      pvInverterGenerations: [],
      batteryPower: 0,
      soc: initialSoc,
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