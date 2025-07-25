import { SiteEnergyConfig, SimulationDataPoint, ControlDecision, TradingSignal, PvInverterGeneration } from "@shared/schema";
import { costOptimizationControlCycle } from "./strategies/cost-optimization-strategy";
import { peakShavingControlCycle } from "./strategies/peak-shaving-strategy";

// Helper function to get generation for a specific PV inverter
export function getPvInverterGeneration(
  dataPoint: SimulationDataPoint, 
  inverterId: string
): number {
  const inverterData = dataPoint.pvInverterGenerations.find(
    gen => gen.inverterId === inverterId
  );
  return inverterData ? inverterData.generation : 0;
}

// Helper function to get all PV inverter generations
export function getAllPvInverterGenerations(
  dataPoint: SimulationDataPoint
): PvInverterGeneration[] {
  return dataPoint.pvInverterGenerations;
}

// Helper function to get total PV generation from inverters with price below threshold
export function getAffordablePvGeneration(
  dataPoint: SimulationDataPoint,
  config: SiteEnergyConfig,
  priceThreshold: number // €/MWh
): number {
  let totalGeneration = 0;
  
  for (const inverter of config.pvInverters) {
    // Inverters without pricePerMWh are considered affordable
    if (inverter.pricePerMWh === undefined || inverter.pricePerMWh < priceThreshold) {
      const generation = getPvInverterGeneration(dataPoint, inverter.id);
      totalGeneration += generation;
    }
  }
  
  return totalGeneration;
}

// Helper function to get total PV generation from inverters with price above threshold (expensive)
export function getExpensivePvGeneration(
  dataPoint: SimulationDataPoint,
  config: SiteEnergyConfig,
  priceThreshold: number // €/MWh
): number {
  let totalGeneration = 0;
  
  for (const inverter of config.pvInverters) {
    // Only include inverters with price higher than threshold
    if (inverter.pricePerMWh !== undefined && inverter.pricePerMWh >= priceThreshold) {
      const generation = getPvInverterGeneration(dataPoint, inverter.id);
      totalGeneration += generation;
    }
  }
  
  return totalGeneration;
}

/**
 * Distribute PV active power setpoint over individual inverters
 * 
 * Logic:
 * 1. Non-controllable inverters always get their full capacity as setpoint
 * 2. Remaining power is distributed proportionally among controllable inverters
 * 3. Actual generation = sum of min(setpoint, generation) for each inverter
 * 
 * Example:
 * - PV setpoint: 30 kW
 * - Non-controllable inverters: 2x 10 kW = 20 kW total
 * - Controllable inverters: 1x 15 kW, 1x 5 kW = 20 kW total
 * - Remaining power: 30 - 20 = 10 kW
 * - Controllable setpoints: 15kW gets 7.5kW (75%), 5kW gets 2.5kW (25%)
 * - If generation is 12kW for 15kW inverter and 3kW for 5kW inverter:
 * - Actual generation: min(7.5, 12) + min(2.5, 3) + 2x10 = 7.5 + 2.5 + 20 = 30 kW
 * 
 * @param dataPoint - Current simulation data point
 * @param config - Site configuration
 * @param pvActivePowerSetpoint - Total power limit for PV inverters
 * @returns Object with inverter setpoints and total actual generation
 */
export function distributePvSetpoint(
  dataPoint: SimulationDataPoint,
  config: SiteEnergyConfig,
  pvActivePowerSetpoint: number
): { inverterSetpoints: Map<string, number>; actualGeneration: number } {
  const inverterSetpoints = new Map<string, number>();
  
  // Separate controllable and non-controllable inverters
  const controllableInverters = config.pvInverters.filter(inverter => inverter.controllable);
  const nonControllableInverters = config.pvInverters.filter(inverter => !inverter.controllable);

  // Calculate total capacity of non-controllable inverters
  const nonControllableCapacity = nonControllableInverters.reduce((sum, inverter) => sum + inverter.capacity, 0);
  
  // Calculate total capacity of controllable inverters
  const controllableCapacity = controllableInverters.reduce((sum, inverter) => sum + inverter.capacity, 0);

  // First, allocate setpoint to non-controllable inverters (they always run at full capacity)
  let remainingPower = Math.max(0, pvActivePowerSetpoint - nonControllableCapacity);
  
  // Set setpoints for non-controllable inverters (always their full capacity)
  nonControllableInverters.forEach(inverter => {
    inverterSetpoints.set(inverter.id, inverter.capacity);
  });

  // Distribute remaining power over controllable inverters proportionally to their capacity
  if (remainingPower > 0 && controllableCapacity > 0) {
    controllableInverters.forEach(inverter => {
      const proportionalSetpoint = (inverter.capacity / controllableCapacity) * remainingPower;
      inverterSetpoints.set(inverter.id, proportionalSetpoint);
    });
  } else {
    // No remaining power, set controllable inverters to 0
    controllableInverters.forEach(inverter => {
      inverterSetpoints.set(inverter.id, 0);
    });
  }

  // Calculate actual generation using min(inverterSetpoint, inverterGeneration) for each inverter
  let actualGeneration = 0;
  config.pvInverters.forEach(inverter => {
    const setpoint = inverterSetpoints.get(inverter.id) || 0;
    const generation = getPvInverterGeneration(dataPoint, inverter.id);
    const actualInverterGeneration = Math.min(setpoint, generation);
    actualGeneration += actualInverterGeneration;
  });

  return { inverterSetpoints, actualGeneration };
}

/**
 * Get individual inverter setpoints for a given PV active power setpoint
 * @param dataPoint - Current simulation data point
 * @param config - Site configuration
 * @param pvActivePowerSetpoint - Total power limit for PV inverters
 * @returns Map of inverter ID to setpoint value
 */
export function getInverterSetpoints(
  dataPoint: SimulationDataPoint,
  config: SiteEnergyConfig,
  pvActivePowerSetpoint: number
): Map<string, number> {
  const { inverterSetpoints } = distributePvSetpoint(dataPoint, config, pvActivePowerSetpoint);
  return inverterSetpoints;
}

/**
 * Get detailed PV setpoint distribution information for debugging
 * @param dataPoint - Current simulation data point
 * @param config - Site configuration
 * @param pvActivePowerSetpoint - Total power limit for PV inverters
 * @returns Detailed information about setpoint distribution
 */
export function getPvSetpointDetails(
  dataPoint: SimulationDataPoint,
  config: SiteEnergyConfig,
  pvActivePowerSetpoint: number
): {
  totalSetpoint: number;
  nonControllableCapacity: number;
  controllableCapacity: number;
  remainingPower: number;
  inverterDetails: Array<{
    id: string;
    capacity: number;
    controllable: boolean;
    setpoint: number;
    generation: number;
    actualGeneration: number;
  }>;
  totalActualGeneration: number;
} {
  const { inverterSetpoints, actualGeneration } = distributePvSetpoint(dataPoint, config, pvActivePowerSetpoint);
  
  const nonControllableCapacity = config.pvInverters
    .filter(inverter => !inverter.controllable)
    .reduce((sum, inverter) => sum + inverter.capacity, 0);
  
  const controllableCapacity = config.pvInverters
    .filter(inverter => inverter.controllable)
    .reduce((sum, inverter) => sum + inverter.capacity, 0);
  
  const remainingPower = Math.max(0, pvActivePowerSetpoint - nonControllableCapacity);
  
  const inverterDetails = config.pvInverters.map(inverter => {
    const setpoint = inverterSetpoints.get(inverter.id) || 0;
    const generation = getPvInverterGeneration(dataPoint, inverter.id);
    const actualInverterGeneration = Math.min(setpoint, generation);
    
    return {
      id: inverter.id,
      capacity: inverter.capacity,
      controllable: inverter.controllable,
      setpoint,
      generation,
      actualGeneration: actualInverterGeneration,
    };
  });
  
  return {
    totalSetpoint: pvActivePowerSetpoint,
    nonControllableCapacity,
    controllableCapacity,
    remainingPower,
    inverterDetails,
    totalActualGeneration: actualGeneration,
  };
}

/**
 * Calculate the actual PV generation after applying PV setpoint
 * @param dataPoint - Current simulation data point
 * @param config - Site configuration
 * @param pvActivePowerSetpoint - Total power limit for PV inverters
 * @returns Actual PV generation after setpoint limitation
 */
export function calculateActualPvGeneration(
  dataPoint: SimulationDataPoint,
  config: SiteEnergyConfig,
  pvActivePowerSetpoint: number
): number {
  const { actualGeneration } = distributePvSetpoint(dataPoint, config, pvActivePowerSetpoint);
  return actualGeneration;
}



export function controlCycle(
  currentSlot: number,
  data: SimulationDataPoint[],
  config: SiteEnergyConfig
): ControlDecision {
  const current = data[currentSlot];
  const horizon = Math.min(48, data.length - currentSlot); // 48 slots (12h) lookahead
  // Get forecast data
  const forecast = data.slice(currentSlot, currentSlot + horizon);

  let decision: ControlDecision = {
    batteryPower: 0,
    pvActivePowerSetpoint: 0,
    loadState: false,
    loadDecisionReason: '',
    batteryDecisionReason: '',
    curtailmentDecisionReason: '',
  };

  // Choose algorithm based on optimization strategy
  if (config.optimizationStrategy === "peak_shaving") {
    decision = peakShavingControlCycle(currentSlot, current, config, forecast);
  } else {
    // Default to cost optimization strategy
    decision = costOptimizationControlCycle(currentSlot, current, config, forecast);
  }

  // Apply grid capacity limits (common for both strategies)
  decision = applyGridCapacityLimits(current, decision, config);

  return decision;
}



  /**
   * Applies grid capacity limits to the control decision.
   * Ensures that the total power flow (consumption + battery + load - PV + setpoint) 
   * respects the import and export limits.
   * 
   * @param current - Current simulation data point
   * @param decision - Control decision to be adjusted
   * @param config - Battery configuration including grid limits
   * @returns Adjusted control decision respecting grid limits
   */
function applyGridCapacityLimits(
  current: SimulationDataPoint,
  decision: ControlDecision,
  config: SiteEnergyConfig
): ControlDecision {
  const adjustedDecision = { ...decision };

  // Calculate total power flow to/from grid
  // Positive = importing from grid, Negative = exporting to grid
  const loadPower = decision.loadState ? config.loadNominalPower : 0;
  const totalPowerFlow = current.consumption + loadPower + decision.batteryPower - current.pvGeneration + decision.pvActivePowerSetpoint;

  // If importing from grid (positive flow)
  if (totalPowerFlow > 0) {
    if (totalPowerFlow > config.gridCapacityImportLimit) {
      // Need to reduce import by increasing local generation or reducing consumption
      const excessImport = totalPowerFlow - config.gridCapacityImportLimit;
      
      // First, try to reduce battery charging (if charging)
      if (decision.batteryPower > 0) {
        const batteryReduction = Math.min(excessImport, decision.batteryPower);
        adjustedDecision.batteryPower -= batteryReduction;
        adjustedDecision.batteryDecisionReason += `<br />Reduced charging by ${batteryReduction.toFixed(2)} kW due to import limit`;
      }
      
      // If still exceeding, try to turn off load (if on)
      const totalPowerFlow2 = current.consumption + loadPower + adjustedDecision.batteryPower - current.pvGeneration + adjustedDecision.pvActivePowerSetpoint;
      if (decision.loadState && totalPowerFlow2 > config.gridCapacityImportLimit) {
        adjustedDecision.loadState = false;
        adjustedDecision.loadDecisionReason += `<br />Turned off load due to import limit`;
      }
      
      // If still exceeding, try to decrease setpoint (i.e., allow more PV injection), but not below 0
      const totalPowerFlow3 = current.consumption + loadPower + adjustedDecision.batteryPower - current.pvGeneration + adjustedDecision.pvActivePowerSetpoint;
      const remainingExcess = totalPowerFlow3 - config.gridCapacityImportLimit;
      if (remainingExcess > 0 && adjustedDecision.pvActivePowerSetpoint > 0) {
        // We can reduce setpoint by at most the current setpoint value, but not below 0
        const setpointDecrease = Math.min(remainingExcess, adjustedDecision.pvActivePowerSetpoint);
        adjustedDecision.pvActivePowerSetpoint -= setpointDecrease;
        // Update setpoint decision reason
        adjustedDecision.curtailmentDecisionReason += `<br />Decreased PV setpoint by ${setpointDecrease.toFixed(2)} kW due to import limit`;
      }
    }
  }
  // If exporting to grid (negative flow)
  else if (totalPowerFlow < 0) {
    const exportPower = Math.abs(totalPowerFlow);
    if (exportPower > config.gridCapacityExportLimit) {
      // Need to reduce export by increasing local consumption or reducing generation
      const excessExport = exportPower - config.gridCapacityExportLimit;

      // First, try to increase battery charging (if not already at max charge rate)
      if (adjustedDecision.batteryPower < config.maxChargeRate) {
        const availableChargeCapacity = config.maxChargeRate - adjustedDecision.batteryPower;
        const batteryIncrease = Math.min(excessExport, availableChargeCapacity);
       adjustedDecision.batteryPower += batteryIncrease;
        adjustedDecision.batteryDecisionReason += `<br />Increased charging by ${batteryIncrease.toFixed(2)} kW due to export limit`;
      }

      // Recalculate total power flow after battery adjustment
      const loadPower2 = adjustedDecision.loadState ? config.loadNominalPower : 0;
      const totalPowerFlow2 = current.consumption + loadPower2 + adjustedDecision.batteryPower - current.pvGeneration + adjustedDecision.pvActivePowerSetpoint;
      const exportPower2 = Math.abs(Math.min(0, totalPowerFlow2));

      // If still exceeding, try to turn on load (if off)
      if (!adjustedDecision.loadState && exportPower2 > config.gridCapacityExportLimit) {
        adjustedDecision.loadState = true;
        adjustedDecision.loadDecisionReason += `<br />Turned on load due to export limit`;
      }

      // Recalculate total power flow after load adjustment
      const loadPower3 = adjustedDecision.loadState ? config.loadNominalPower : 0;
      const totalPowerFlow3 = current.consumption + loadPower3 + adjustedDecision.batteryPower - current.pvGeneration + adjustedDecision.pvActivePowerSetpoint;
      const exportPower3 = Math.abs(Math.min(0, totalPowerFlow3));
      const remainingExcess = exportPower3 - config.gridCapacityExportLimit;

      // If still exceeding, increase setpoint, but only up to current PV generation
      if (remainingExcess > 0) {
        const maxAdditionalSetpoint = Math.max(0, current.pvGeneration - adjustedDecision.pvActivePowerSetpoint);
        const setpointIncrease = Math.min(remainingExcess, maxAdditionalSetpoint);
        adjustedDecision.pvActivePowerSetpoint += setpointIncrease;
        adjustedDecision.curtailmentDecisionReason += `<br />Increased PV setpoint by ${setpointIncrease.toFixed(2)} kW due to export limit`;
      }
    }
  }
  
  return adjustedDecision;
}
