import { SiteEnergyConfig, SimulationDataPoint, ControlDecision } from "@shared/schema";
import { storeLoadState } from "../storage";

/**
 * Peak shaving control cycle algorithm
 * Discharges during peak consumption and charges during low consumption
 */
export function peakShavingControlCycle(
  currentSlot: number,
  current: SimulationDataPoint,
  config: SiteEnergyConfig,
  forecast: SimulationDataPoint[]
): ControlDecision {
  let decision: ControlDecision = {
    batteryPower: 0,
    pvActivePowerSetpoint: 0,
    loadState: false,
    loadDecisionReason: '',
    batteryDecisionReason: '',
    curtailmentDecisionReason: '',
  };

  // Calculate current grid power (positive = importing, negative = exporting)
  const loadPower = decision.loadState ? config.loadNominalPower : 0;
  const currentGridPower = current.consumption + loadPower - current.pvGeneration;

  // Peak shaving logic
  const peakShavingDecision = peakShavingBatteryControl(current, config, currentGridPower);
  decision.batteryPower = peakShavingDecision.power;
  decision.batteryDecisionReason = peakShavingDecision.reason;

  // Controllable load logic (simplified for peak shaving - just use basic logic)
  const loadDecision = determineLoadState(currentSlot, decision.batteryPower, config, current);
  decision.loadState = loadDecision.state;
  decision.loadDecisionReason = loadDecision.reason;
  
  // Store the load state for future reference
  storeLoadState(currentSlot, decision.loadState);

  // PV setpoint logic (simplified for peak shaving)
  const setpointResult = calculatePvSetpoint(current, decision, config);
  decision.pvActivePowerSetpoint = setpointResult.setpoint;
  decision.curtailmentDecisionReason = setpointResult.reason;

  return decision;
}

/**
 * Peak shaving battery control logic
 * Uses the four thresholds to determine when to charge/discharge
 */
function peakShavingBatteryControl(
  current: SimulationDataPoint,
  config: SiteEnergyConfig,
  currentGridPower: number
): { power: number; reason: string } {
  // --- Trading Signal Check ---
  if (config.tradingSignalEnabled) {
    switch (current.tradingSignal) {
      case "standby":
        return { power: 0, reason: 'trading signal: standby - battery idle (peak shaving)' };
      case "overrule":
        const requestedPower = current.tradingSignalRequestedPower;
        if (requestedPower > 0) {
          // Charging requested
          const maxChargePower = Math.min(requestedPower, config.maxChargeRate);
          if (current.soc >= config.maxSoc) {
            return { power: 0, reason: 'trading signal: overrule - cannot charge, battery full (peak shaving)' };
          }
          return { 
            power: maxChargePower, 
            reason: `trading signal: overrule - charging ${maxChargePower.toFixed(2)} kW (requested: ${requestedPower.toFixed(2)} kW) (peak shaving)` 
          };
        } else if (requestedPower < 0) {
          // Discharging requested
          const dischargePower = Math.abs(requestedPower);
          const maxDischargePower = Math.min(dischargePower, config.maxDischargeRate);
          if (current.soc <= config.minSoc) {
            return { power: 0, reason: 'trading signal: overrule - cannot discharge, battery empty (peak shaving)' };
          }
          return { 
            power: -maxDischargePower, 
            reason: `trading signal: overrule - discharging ${maxDischargePower.toFixed(2)} kW (requested: ${dischargePower.toFixed(2)} kW) (peak shaving)` 
          };
        } else {
          // No power requested
          return { power: 0, reason: 'trading signal: overrule - no power requested (peak shaving)' };
        }
      case "local":
        // Continue with normal peak shaving logic
        break;
    }
  }

  // Check battery availability
  if (current.soc <= config.minSoc) {
    return { power: 0, reason: 'battery empty (peak shaving)' };
  }

  if (current.soc >= config.maxSoc) {
    return { power: 0, reason: 'battery full (peak shaving)' };
  }

  // Calculate available energy for discharge
  const socEnergy = (current.soc / 100) * config.batteryCapacity;
  const minEnergy = (config.minSoc / 100) * config.batteryCapacity;
  const availableDischargeEnergy = socEnergy - minEnergy;
  const maxDischargePower = Math.min(config.maxDischargeRate, config.gridCapacityExportLimit);

  // Calculate available capacity for charging
  const maxEnergy = (config.maxSoc / 100) * config.batteryCapacity;
  const availableChargeEnergy = maxEnergy - socEnergy;
  const maxChargePower = config.maxChargeRate;

  // Peak shaving logic based on thresholds
  if (currentGridPower > config.peakShavingDischargeStart) {
    // Grid power is above discharge start threshold - start discharging
    const targetGridPower = config.peakShavingDischargeStart;
    const requiredDischargePower = currentGridPower - targetGridPower;
    const actualDischargePower = Math.min(requiredDischargePower, maxDischargePower, availableDischargeEnergy / 0.25);
    
    return {
      power: -actualDischargePower,
      reason: `peak shaving: discharging ${actualDischargePower.toFixed(2)} kW to reduce grid power from ${currentGridPower.toFixed(2)} kW to ${targetGridPower} kW`
    };
  } else if (currentGridPower < config.peakShavingDischargeStop && currentGridPower > config.peakShavingChargeStop) {
    // Grid power is between discharge stop and charge stop - no action
    return {
      power: 0,
      reason: `peak shaving: grid power ${currentGridPower.toFixed(2)} kW is between discharge stop (${config.peakShavingDischargeStop} kW) and charge stop (${config.peakShavingChargeStop} kW) - no action`
    };
  } else if (currentGridPower < config.peakShavingChargeStart) {
    // Grid power is below charge start threshold - start charging
    const targetGridPower = config.peakShavingChargeStart;
    const requiredChargePower = targetGridPower - currentGridPower;
    const actualChargePower = Math.min(requiredChargePower, maxChargePower, availableChargeEnergy / 0.25);
    
    return {
      power: actualChargePower,
      reason: `peak shaving: charging ${actualChargePower.toFixed(2)} kW to increase grid power from ${currentGridPower.toFixed(2)} kW to ${targetGridPower} kW`
    };
  } else {
    // Grid power is between charge start and charge stop - no action
    return {
      power: 0,
      reason: `peak shaving: grid power ${currentGridPower.toFixed(2)} kW is between charge start (${config.peakShavingChargeStart} kW) and charge stop (${config.peakShavingChargeStop} kW) - no action`
    };
  }
}

/**
 * Simplified load state determination for peak shaving
 * Just uses basic logic without complex optimization
 */
function determineLoadState(
  currentSlot: number,
  batteryPower: number,
  config: SiteEnergyConfig,
  current: SimulationDataPoint
): { state: boolean; reason: string } {
  // For peak shaving, we use a simplified approach
  // Just activate load when there's negative consumption price
  if (current.consumptionPrice < 0) {
    return { state: true, reason: 'negative consumption price (peak shaving)' };
  }
  
  return { state: false, reason: 'no negative prices (peak shaving)' };
}

/**
 * Simplified PV setpoint for peak shaving
 */
function calculatePvSetpoint(
  current: SimulationDataPoint,
  decision: ControlDecision,
  config: SiteEnergyConfig
): { setpoint: number; reason: string } {
  // Calculate total capacity of non-controllable inverters
  const nonControllableCapacity = config.pvInverters
    .filter(inverter => !inverter.controllable)
    .reduce((sum, inverter) => sum + inverter.capacity, 0);

  // Calculate total capacity of controllable inverters
  const controllableCapacity = config.pvInverters
    .filter(inverter => inverter.controllable)
    .reduce((sum, inverter) => sum + inverter.capacity, 0);

  // Calculate current PV generation from individual inverters
  const currentPvGeneration = current.pvInverterGenerations.reduce((sum, gen) => sum + gen.generation, 0);

  if (current.consumptionPrice < 0) {
    // At negative consumption price, setpoint is only non-controllable capacity
    return { setpoint: nonControllableCapacity, reason: 'negative consumption price - PV setpoint limited to non-controllable capacity (peak shaving)' };
  }

  if (current.injectionPrice < 0) {
    let effectiveConsumption = current.consumption + decision.batteryPower;
    if (decision.loadState) {
      effectiveConsumption += config.loadNominalPower;
    }
    const excess = Math.max(0, currentPvGeneration - effectiveConsumption);
    
    // Setpoint is non-controllable capacity plus any controllable capacity needed to avoid excess
    const controllableNeeded = Math.min(excess, controllableCapacity);
    const setpoint = nonControllableCapacity + controllableNeeded;
    return { setpoint, reason: 'negative injection price - PV setpoint limited to avoid excess (peak shaving)' };
  }

  return { setpoint: nonControllableCapacity + controllableCapacity, reason: 'no setpoint limitation needed (peak shaving)' };
} 