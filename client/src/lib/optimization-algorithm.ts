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
  const cheapestSlots = getCheapestChargeSlots(forecast, current.soc, config);
  const mostExpensiveSlots = getBestDischargeSlots(forecast, current.soc, config);

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
      decision.reason = dischargeDecision.reason;
    } else {
      // when holding, pick reason from dischargeDecision or chargeDecision
      decision.reason = dischargeDecision.reason || chargeDecision.reason;
    }
  }

  return decision;
}

function getCheapestChargeSlots(
  forecast: SimulationDataPoint[],
  currentSoc: number,
  config: BatteryConfig
): number[] {
  if (currentSoc >= config.maxSoc) return [];

  const sortedSlots = forecast
    .map((slot, index) => ({
      index,
      price: slot.price,
    }))
    .sort((a, b) => a.price - b.price);

  // Return indices of cheapest 25% of slots
  const numSlots = Math.ceil(sortedSlots.length * 0.25);
  return sortedSlots.slice(0, numSlots).map((slot) => slot.index);
}

function getBestDischargeSlots(
  forecast: SimulationDataPoint[],
  currentSoc: number,
  config: BatteryConfig
): number[] {
  if (currentSoc <= config.minSoc) return [];

  const sortedSlots = forecast
    .map((slot, index) => ({
      index,
      price: slot.price,
    }))
    .sort((a, b) => b.price - a.price);

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
  if (!cheapestSlots.includes(currentSlot)) {
    return { power: 0, reason: 'not cheapest slot' };
  }
  if (current.soc >= config.maxSoc) {
    return { power: 0, reason: 'battery full' };
  }

  const futureDeficit = forecast
    .slice(0, 8)
    .reduce((sum, slot) => sum + Math.max(0, slot.consumption - slot.pvForecast), 0);

  if (futureDeficit <= 0) {
    return { power: 0, reason: 'no future deficit' };
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
