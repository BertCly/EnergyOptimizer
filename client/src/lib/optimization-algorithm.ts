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
  const chargePower = shouldChargeNow(currentSlot, cheapestSlots, current, config, forecast);
  if (chargePower > 0) {
    decision.batteryPower = chargePower;
    decision.decision = 'charge';
  }
  // Discharging logic
  else {
    const dischargePower = shouldDischargeNow(currentSlot, mostExpensiveSlots, current, config, decision.relayState);
    if (dischargePower > 0) {
      decision.batteryPower = -dischargePower;
      decision.decision = 'discharge';
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
): number {
  if (!cheapestSlots.includes(currentSlot)) return 0;
  if (current.soc >= config.maxSoc) return 0;

  const futureDeficit = forecast
    .slice(0, 8)
    .reduce((sum, slot) => sum + Math.max(0, slot.consumption - slot.pvForecast), 0);

  if (futureDeficit <= 0) return 0;

  return config.maxChargeRate;
}

function shouldDischargeNow(
  currentSlot: number,
  mostExpensiveSlots: number[],
  current: SimulationDataPoint,
  config: BatteryConfig,
  relayState: boolean
): number {
  if (current.soc <= config.minSoc) return 0;

  // Calculate what's needed: consumption minus PV production
  let effectiveConsumption = current.consumption;
  
  // Add relay consumption when relay is ON
  if (relayState) {
    effectiveConsumption += config.relayConsumption;
  }
  
  const deficit = Math.max(0, effectiveConsumption - current.pvGeneration);
  
  // Only discharge what's actually needed, up to max discharge rate
  return Math.min(deficit, config.maxDischargeRate);
}
