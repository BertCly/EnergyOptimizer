import { z } from "zod";

// Battery Configuration Schema
export const batteryConfigSchema = z.object({
  batteryCapacity: z.number().min(10).max(1000).default(200),
  maxChargeRate: z.number().min(1).max(500).default(200),
  maxDischargeRate: z.number().min(1).max(500).default(200),
  initialSoc: z.number().min(0).max(100).default(50),
  minSoc: z.number().min(0).max(100).default(5),
  maxSoc: z.number().min(0).max(100).default(95),
  priceThreshold: z.number().min(0).max(1).default(0.30),
});

// Simulation Data Point Schema
export const simulationDataPointSchema = z.object({
  time: z.date(),
  timeString: z.string(),
  price: z.number(),
  injectionPrice: z.number().default(0),
  consumptionPrice: z.number().default(0),
  consumption: z.number(),
  pvGeneration: z.number(),
  pvForecast: z.number(),
  batteryPower: z.number(),
  soc: z.number(),
  netPower: z.number(),
  cost: z.number(),
  curtailment: z.number().default(0),
  relayState: z.boolean().default(false),
  decision: z.string().default('hold'),
});

// Control Decision Schema
export const controlDecisionSchema = z.object({
  batteryPower: z.number(),
  curtailment: z.number().default(0),
  relayState: z.boolean().default(false),
  decision: z.string().default('hold'),
});

// Export types
export type BatteryConfig = z.infer<typeof batteryConfigSchema>;
export type SimulationDataPoint = z.infer<typeof simulationDataPointSchema>;
export type ControlDecision = z.infer<typeof controlDecisionSchema>;
