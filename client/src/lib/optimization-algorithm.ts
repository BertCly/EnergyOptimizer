import { SiteEnergyConfig, SimulationDataPoint, ControlDecision } from "@shared/schema";
import { costOptimizationControlCycle } from "./strategies/cost-optimization-strategy";
import { peakShavingControlCycle } from "./strategies/peak-shaving-strategy";



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
    curtailment: 0,
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
 * Ensures that the total power flow (consumption + battery + load - PV + curtailment) 
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
  const totalPowerFlow = current.consumption + loadPower + decision.batteryPower - current.pvGeneration + decision.curtailment;

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
      const totalPowerFlow2 = current.consumption + loadPower + adjustedDecision.batteryPower - current.pvGeneration + adjustedDecision.curtailment;
      if (decision.loadState && totalPowerFlow2 > config.gridCapacityImportLimit) {
        adjustedDecision.loadState = false;
        adjustedDecision.loadDecisionReason += `<br />Turned off load due to import limit`;
      }
      
      // If still exceeding, try to decrease curtailment (i.e., allow more PV injection), but not below 0
      const totalPowerFlow3 = current.consumption + loadPower + adjustedDecision.batteryPower - current.pvGeneration + adjustedDecision.curtailment;
      const remainingExcess = totalPowerFlow3 - config.gridCapacityImportLimit;
      if (remainingExcess > 0 && adjustedDecision.curtailment > 0) {
        // We can reduce curtailment by at most the current curtailment value, but not below 0
        const curtailmentDecrease = Math.min(remainingExcess, adjustedDecision.curtailment);
        adjustedDecision.curtailment -= curtailmentDecrease;
        // Update curtailment decision reason
        adjustedDecision.curtailmentDecisionReason += `<br />Decreased curtailment by ${curtailmentDecrease.toFixed(2)} kW due to import limit`;
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
      const totalPowerFlow2 = current.consumption + loadPower2 + adjustedDecision.batteryPower - current.pvGeneration + adjustedDecision.curtailment;
      const exportPower2 = Math.abs(Math.min(0, totalPowerFlow2));

      // If still exceeding, try to turn on load (if off)
      if (!adjustedDecision.loadState && exportPower2 > config.gridCapacityExportLimit) {
        adjustedDecision.loadState = true;
        adjustedDecision.loadDecisionReason += `<br />Turned on load due to export limit`;
      }

      // Recalculate total power flow after load adjustment
      const loadPower3 = adjustedDecision.loadState ? config.loadNominalPower : 0;
      const totalPowerFlow3 = current.consumption + loadPower3 + adjustedDecision.batteryPower - current.pvGeneration + adjustedDecision.curtailment;
      const exportPower3 = Math.abs(Math.min(0, totalPowerFlow3));
      const remainingExcess = exportPower3 - config.gridCapacityExportLimit;

      // If still exceeding, increase curtailment, but only up to current PV generation
      if (remainingExcess > 0) {
        const maxAdditionalCurtailment = Math.max(0, current.pvGeneration - adjustedDecision.curtailment);
        const curtailmentIncrease = Math.min(remainingExcess, maxAdditionalCurtailment);
        adjustedDecision.curtailment += curtailmentIncrease;
        adjustedDecision.curtailmentDecisionReason += `<br />Increased curtailment by ${curtailmentIncrease.toFixed(2)} kW due to export limit`;
      }
    }
  }
  
  return adjustedDecision;
}
