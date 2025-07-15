import { SimulationDataPoint } from "@shared/schema";

// Fixed data that won't change when configuration is adjusted
export const FIXED_SIMULATION_DATA = {
  prices: {
    8: { injection: 0.050, consumption: 0.150 },
    9: { injection: 0.045, consumption: 0.140 },
    10: { injection: 0.040, consumption: 0.130 },
    11: { injection: 0.035, consumption: 0.120 },
    12: { injection: 0.030, consumption: 0.110 },
    13: { injection: 0.025, consumption: 0.105 },
    14: { injection: -0.125, consumption: -0.016 },
    15: { injection: -0.115, consumption: -0.006 },
    16: { injection: -0.020, consumption: 0.092 },
    17: { injection: 0.038, consumption: 0.155 },
    18: { injection: 0.049, consumption: 0.168 },
    19: { injection: 0.062, consumption: 0.184 },
    20: { injection: 0.075, consumption: 0.200 },
    21: { injection: 0.092, consumption: 0.221 },
    22: { injection: 0.083, consumption: 0.210 },
    23: { injection: 0.065, consumption: 0.188 },
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

export function generateFixedSimulationData(initialSoc: number): SimulationDataPoint[] {
  const data: SimulationDataPoint[] = [];
  const startTime = new Date();
  startTime.setHours(8, 0, 0, 0); // Start at 8:00 AM

  for (let i = 0; i < 48; i++) {
    const time = new Date(startTime.getTime() + i * 15 * 60 * 1000);
    const hour = time.getHours();
    
    // Get fixed price data
    const pricePair = FIXED_SIMULATION_DATA.prices[hour as keyof typeof FIXED_SIMULATION_DATA.prices] || 
                      { injection: 0.050, consumption: 0.150 };
    
    data.push({
      time,
      timeString: time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      price: pricePair.consumption, // Use consumption price as main price
      injectionPrice: pricePair.injection,
      consumptionPrice: pricePair.consumption,
      consumption: FIXED_SIMULATION_DATA.consumption[i],
      pvGeneration: FIXED_SIMULATION_DATA.pvGeneration[i],
      pvForecast: FIXED_SIMULATION_DATA.pvForecast[i],
      batteryPower: 0,
      soc: initialSoc,
      netPower: 0,
      cost: 0,
      curtailment: 0,
      relayState: false,
      decision: 'hold',
      reason: '',
    });
  }

  return data;
}