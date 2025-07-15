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

  // Charging logic
  if (shouldChargeNow(currentSlot, cheapestSlots, current.soc, config)) {
    const maxCharge = Math.min(
      config.maxChargeRate,
      ((config.maxSoc - current.soc) * config.batteryCapacity) / 100 / 4 // Convert to kW for 15-min interval
    );
    decision.batteryPower = Math.min(maxCharge, config.maxChargeRate);
    decision.decision = 'charge';
  }
  // Discharging logic
  else if (shouldDischargeNow(currentSlot, mostExpensiveSlots, current.soc, config)) {
    const maxDischarge = Math.min(
      config.maxDischargeRate,
      ((current.soc - config.minSoc) * config.batteryCapacity) / 100 / 4 // Convert to kW for 15-min interval
    );
    decision.batteryPower = -Math.min(maxDischarge, config.maxDischargeRate);
    decision.decision = 'discharge';
  }

  // PV Curtailment Logic - only when EPEX price is negative
  if (current.price < 0) {
    decision.curtailment = current.pvGeneration;
  }
  
  // Relay Control Logic
  const pvOverproduction = Math.max(0, current.pvGeneration - current.consumption);
  decision.relayState = (pvOverproduction > 0 && current.soc >= config.maxSoc) || 
                        (current.price <= 0);

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
  soc: number,
  config: BatteryConfig
): boolean {
  return cheapestSlots.includes(currentSlot) && soc < config.maxSoc;
}

function shouldDischargeNow(
  currentSlot: number,
  mostExpensiveSlots: number[],
  soc: number,
  config: BatteryConfig
): boolean {
  return mostExpensiveSlots.includes(currentSlot) && soc > config.minSoc;
}
