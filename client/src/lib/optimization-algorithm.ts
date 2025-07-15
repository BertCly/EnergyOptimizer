import { BatteryConfig, SimulationDataPoint, ControlDecision } from "@shared/schema";

export function controlCycle(
  currentSlot: number,
  data: SimulationDataPoint[],
  config: BatteryConfig
): ControlDecision {
  const current = data[currentSlot];
  const horizon = Math.min(12, data.length - currentSlot); // 12 slots or remaining slots

  // Get forecast data
  const forecast = data.slice(currentSlot, currentSlot + horizon);

  // Find cheapest and most expensive slots
  const cheapestSlots = getCheapestChargeSlots(forecast, current.soc, config, currentSlot);
  const mostExpensiveSlots = getBestDischargeSlots(forecast, current.soc, config, currentSlot);
  // console.log('Goedkoopste tijdslots:', cheapestSlots);

  let decision: ControlDecision = {
    batteryPower: 0,
    curtailment: 0,
    relayState: false,
    decision: 'hold',
    reason: '',
  };

  // Relay Control Logic - determine first as it affects consumption
  const pvOverproduction = Math.max(0, current.pvGeneration - current.consumption);
  decision.relayState = (pvOverproduction > 0 && current.soc >= config.maxSoc) ||
                        (current.consumptionPrice <= 0);

  // PV Curtailment Logic - curtail only excess to reach 0kW net consumption
  if (current.injectionPrice < 0) {
    let effectiveConsumption = current.consumption + decision.batteryPower;
    if (decision.relayState) {
      effectiveConsumption += config.relayConsumption;
    }
    
    const excess = Math.max(0, current.pvGeneration - effectiveConsumption);
    decision.curtailment = excess;
  }

  // Charging logic
  const chargeDecision = shouldChargeNow(currentSlot, cheapestSlots, current, config, forecast);
  if (chargeDecision.power > 0) {
    decision.batteryPower = chargeDecision.power;
    decision.decision = 'charge';
    decision.reason = chargeDecision.reason;
  }
  // Discharging logic
  else {
    const dischargeDecision = shouldDischargeNow(currentSlot, mostExpensiveSlots, current, config, decision.relayState);
    if (dischargeDecision.power > 0) {
      decision.batteryPower = -dischargeDecision.power;
      decision.decision = 'discharge';
      decision.reason = `Charge decision: ${chargeDecision.reason}\nDischarge decision: ${dischargeDecision.reason}`;
    } else {
      // when holding, pick reason from dischargeDecision or chargeDecision
      decision.reason = `Charge decision: ${chargeDecision.reason}\nDischarge decision: ${dischargeDecision.reason}`;
    }
  }

  return decision;
}

function getCheapestChargeSlots(
  forecast: SimulationDataPoint[],
  currentSoc: number,
  config: BatteryConfig,
  startIndex: number
): number[] {
  if (currentSoc >= config.maxSoc) return [];

  const sortedSlots = forecast
    .map((slot, index) => ({
      index: index + startIndex,
      consumptionPrice: slot.consumptionPrice,
    }))
    .sort((a, b) => a.consumptionPrice - b.consumptionPrice);

  // Return indices of cheapest 25% of slots
  const numSlots = Math.ceil(sortedSlots.length * 0.25);
  return sortedSlots.slice(0, numSlots).map((slot) => slot.index);
}

function getBestDischargeSlots(
  forecast: SimulationDataPoint[],
  currentSoc: number,
  config: BatteryConfig,
  startIndex: number
): number[] {
  if (currentSoc <= config.minSoc) return [];

  const sortedSlots = forecast
    .map((slot, index) => ({
      index: index + startIndex,
      injectionPrice: slot.injectionPrice,
    }))
    .sort((a, b) => b.injectionPrice - a.injectionPrice);

  // Return indices of most expensive 25% of slots
  const numSlots = Math.ceil(sortedSlots.length * 0.25);
  return sortedSlots.slice(0, numSlots).map((slot) => slot.index);
}

function shouldChargeNow(
  currentSlot: number,
  cheapestSlots: number[],
  current: SimulationDataPoint,
  config: BatteryConfig,
  forecast: SimulationDataPoint[]
): { power: number; reason: string } {
  const pvSurplus = current.pvGeneration - current.consumption;
  if (pvSurplus > 0 && current.soc < config.maxSoc) {
    return {
      power: Math.min(pvSurplus, config.maxChargeRate),
      reason: 'pv surplus',
    };
  }

  const futureDeficit = forecast
    .slice(0, 16)
    .some((slot, i) =>
      cheapestSlots.includes(currentSlot + i) && slot.pvForecast < slot.consumption
    );

  if (!futureDeficit) {
    return { power: 0, reason: 'no future deficit' };
  }

  if (!cheapestSlots.includes(currentSlot)) {
    return { power: 0, reason: 'not cheapest slot' };
  }
  if (current.soc >= config.maxSoc) {
    return { power: 0, reason: 'battery full' };
  }

  return { power: config.maxChargeRate, reason: 'cheap energy available' };
}

function shouldDischargeNow(
  currentSlot: number,
  mostExpensiveSlots: number[],
  current: SimulationDataPoint,
  config: BatteryConfig,
  relayState: boolean
): { power: number; reason: string } {
  if (!mostExpensiveSlots.includes(currentSlot)) {
    return { power: 0, reason: 'not expensive slot' };
  }
  if (current.soc <= config.minSoc) {
    return { power: 0, reason: 'battery empty' };
  }

  // Calculate what's needed: consumption minus PV production
  let effectiveConsumption = current.consumption;
  
  // Add relay consumption when relay is ON
  if (relayState) {
    effectiveConsumption += config.relayConsumption;
  }
  
  const deficit = Math.max(0, effectiveConsumption - current.pvGeneration);

  if (deficit <= 0) {
    return { power: 0, reason: 'no deficit to cover' };
  }

  // Only discharge what's actually needed, up to max discharge rate
  return { power: Math.min(deficit, config.maxDischargeRate), reason: 'cover consumption' };
}
