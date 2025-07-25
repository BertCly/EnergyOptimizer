import { z } from "zod";

// Optimization Strategy Enum
export const optimizationStrategySchema = z.enum(["cost_optimization", "peak_shaving"]);

// Trading Signal Enum
export const tradingSignalSchema = z.enum(["standby", "local", "overrule"]);

// PV Inverter Schema
export const pvInverterSchema = z.object({
  id: z.string(),
  capacity: z.number().min(0.1).max(1000).default(10), // kW
  pricePerMWh: z.number().min(0).optional(), // Optional price per MWh
  controllable: z.boolean().default(true), // Whether this inverter can be controlled/curtailed
});

// Individual PV Inverter Generation Data
export const pvInverterGenerationSchema = z.object({
  inverterId: z.string(),
  generation: z.number(), // kW
});

// Site Energy Configuration Schema
export const siteEnergyConfigSchema = z.object({
  // Optimization strategy
  optimizationStrategy: optimizationStrategySchema.default("cost_optimization"),
  
  // Trading signal configuration
  tradingSignalEnabled: z.boolean().default(false),
  
  // Peak shaving thresholds (only used in peak_shaving strategy)
  peakShavingDischargeStart: z.number().min(0).max(1000).default(30), // kW - Start discharge above this grid power
  peakShavingDischargeStop: z.number().min(0).max(1000).default(25),  // kW - Stop discharging below this grid power
  peakShavingChargeStop: z.number().min(-1000).max(1000).default(0),      // kW - Stop charging above this grid power
  peakShavingChargeStart: z.number().min(-1000).max(1000).default(-1),      // kW - Start charging below this grid power
  
  batteryCapacity: z.number().min(10).max(1000).default(200),
  maxChargeRate: z.number().min(1).max(500).default(200),
  maxDischargeRate: z.number().min(1).max(500).default(200),
  initialSoc: z.number().min(0).max(100).default(50),
  minSoc: z.number().min(0).max(100).default(5),
  maxSoc: z.number().min(0).max(100).default(95),
  batteryRoundTripEfficiency: z.number().min(0.1).max(1.0).default(0.95), // Efficiency as decimal (95% = 0.95)
  batteryMinPriceDifference: z.number().min(0).max(1000).default(20), // Minimum price difference in EUR/MWh
  loadMinRuntimeActivation: z.number().min(0).default(0.5),
  loadMinRuntimeDaily: z.number().min(0).default(2),
  loadRuntimeDeadlineHour: z.number().min(0).max(23).default(20),
  loadActivationPower: z.number().min(0).default(40),
  loadNominalPower: z.number().min(0).default(50),
  gridCapacityImportLimit: z.number().min(0).max(1000).default(200),
  gridCapacityExportLimit: z.number().min(0).max(1000).default(200),
  pvInverters: z.array(pvInverterSchema).default([
    {
      id: "default-pv-inverter",
      capacity: 50,
      controllable: true,
    }
  ]),
});

// Simulation Data Point Schema
export const simulationDataPointSchema = z.object({
  time: z.date(),
  timeString: z.string(),
  injectionPrice: z.number().default(0),
  consumptionPrice: z.number().default(0),
  consumption: z.number(),
  pvGeneration: z.number(),
  pvForecast: z.number(),
  pvInverterGenerations: z.array(pvInverterGenerationSchema).default([]), // Individual inverter generations
  actualPvGeneration: z.number().default(0), // Actual PV generation after setpoint limitation
  batteryPower: z.number(),
  soc: z.number(),
  netPower: z.number(),
  cost: z.number(),
  pvActivePowerSetpoint: z.number().default(0), // Total power limit for PV inverters (renamed from curtailment)
  loadState: z.boolean().default(false),
  loadDecisionReason: z.string().default(''),
  batteryDecisionReason: z.string().default(''),
  curtailmentDecisionReason: z.string().default(''),
  tradingSignal: tradingSignalSchema.default("local"),
  tradingSignalRequestedPower: z.number().default(0),
});

// Control Decision Schema
export const controlDecisionSchema = z.object({
  batteryPower: z.number(),
  pvActivePowerSetpoint: z.number().default(0), // Total power limit for PV inverters (renamed from curtailment)
  loadState: z.boolean().default(false),
  loadDecisionReason: z.string().default(''),
  batteryDecisionReason: z.string().default(''),
  curtailmentDecisionReason: z.string().default(''),
});

// Export types
export type OptimizationStrategy = z.infer<typeof optimizationStrategySchema>;
export type TradingSignal = z.infer<typeof tradingSignalSchema>;
export type SiteEnergyConfig = z.infer<typeof siteEnergyConfigSchema>;
export type PvInverter = z.infer<typeof pvInverterSchema>;
export type PvInverterGeneration = z.infer<typeof pvInverterGenerationSchema>;
export type SimulationDataPoint = z.infer<typeof simulationDataPointSchema>;
export type ControlDecision = z.infer<typeof controlDecisionSchema>;
