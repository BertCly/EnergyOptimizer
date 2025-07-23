import { SimulationDataPoint } from "@shared/schema";

export const SIMULATION_SLOTS = 96; // 24h at 15 min intervals
export const FORECAST_SLOTS = 48;   // extra 12h forecast
export const TOTAL_SLOTS = SIMULATION_SLOTS + FORECAST_SLOTS;