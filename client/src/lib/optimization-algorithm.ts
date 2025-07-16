import { BatteryConfig, SimulationDataPoint, ControlDecision } from "@shared/schema";

export function controlCycle(
  currentSlot: number,
  data: SimulationDataPoint[],
  config: BatteryConfig
): ControlDecision {
  const current = data[currentSlot];
  const horizon = Math.min(48, data.length - currentSlot); // 48 slots (12h) lookahead

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

  // Charging logic
  const chargeDecision = shouldChargeNow(currentSlot, cheapestSlots, current, config, forecast);
  if (chargeDecision.power > 0) {
    decision.batteryPower = chargeDecision.power;
    decision.decision = 'charge';
    decision.reason = chargeDecision.reason;
  }
  // Discharging logic
  else {
    const dischargeDecision = shouldDischargeNow(
      currentSlot,
      mostExpensiveSlots,
      current,
      config,
      decision.relayState,
      forecast
    );
    if (dischargeDecision.power > 0) {
      decision.batteryPower = -dischargeDecision.power;
      decision.decision = 'discharge';
      decision.reason = `Charge decision: ${chargeDecision.reason}\nDischarge decision: ${dischargeDecision.reason}`;
    } else {
      // when holding, pick reason from dischargeDecision or chargeDecision
      decision.reason = `Charge decision: ${chargeDecision.reason}\nDischarge decision: ${dischargeDecision.reason}`;
    }
  }

   // Relay Control Logic - determine first as it affects consumption
  const prevRelay = currentSlot > 0 ? data[currentSlot - 1].relayState : false;
  let activationRuntime = 0;
  if (prevRelay) {
    for (let i = currentSlot - 1; i >= 0 && data[i].relayState; i--) {
      activationRuntime += 0.25;
    }
  }
  let dailyRuntime = 0;
  for (let i = 0; i < currentSlot; i++) {
    if (data[i].relayState) dailyRuntime += 0.25;
  }

  const oversupply = current.pvGeneration - current.consumption - Math.max(decision.batteryPower, 0);
  const gridImport = Math.max(0, current.consumption + Math.max(decision.batteryPower,0) - current.pvGeneration);
  const needDailyRuntime = current.time.getHours() >= config.relayRuntimeDeadlineHour &&
                           dailyRuntime < config.relayMinRuntimeDaily;

  let relay = prevRelay;
  if (relay) {
    activationRuntime += 0.25;
    if (activationRuntime >= config.relayMinRuntimeActivation && !needDailyRuntime) {
      if (config.relayActivationPower >= config.relayNominalPower) {
        if (oversupply < config.relayNominalPower) relay = false;
      } else {
        if (gridImport > (config.relayNominalPower - config.relayActivationPower)) relay = false;
      }
    }
  } else {
    if (oversupply >= config.relayActivationPower || needDailyRuntime) {
      relay = true;
    }
  }

  decision.relayState = relay;

  // PV Curtailment Logic
  if (current.consumptionPrice < 0) {
    // Negative consumption price: curtail all PV to maximize grid offtake
    decision.curtailment = current.pvGeneration;
  } else if (current.injectionPrice < 0) {
    // Negative injection price: only curtail excess to avoid injecting
    let effectiveConsumption = current.consumption + decision.batteryPower;
    if (decision.relayState) {
      effectiveConsumption += config.relayNominalPower;
    }

    const excess = Math.max(0, current.pvGeneration - effectiveConsumption);
    decision.curtailment = excess;
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
   if (current.soc >= config.maxSoc) {
    return { power: 0, reason: 'battery full' };
  }

  // const futureDeficit = forecast
  //   .slice(0, 16)
  //   .some((slot, i) =>
  //     cheapestSlots.includes(currentSlot + i) && slot.pvForecast < slot.consumption
  //   );
   const futureDeficit = forecast
  .slice(0, 16)
  .reduce((total, slot, i) => {
    const globalIndex = currentSlot + i;

    if (!cheapestSlots.includes(globalIndex)) return total;

    const deficit = slot.consumption - slot.pvForecast;
    return total + Math.max(0, deficit); // enkel positieve tekorten optellen
  }, 0);
  if (futureDeficit > 0) {
    return {
      power: Math.min(futureDeficit / 0.25, config.maxChargeRate),
      reason: `Laad bij voor toekomstig tekort van ${futureDeficit.toFixed(2)} kWh (saldo komende 4 uur)`
    };
  }


  const pvSurplus = current.pvGeneration - current.consumption;
  if (pvSurplus > 0) {
    return {
      power: Math.min(pvSurplus, config.maxChargeRate),
      reason: 'pv surplus',
    };
  }

  if (!cheapestSlots.includes(currentSlot)) {
    return { power: 0, reason: 'not cheap slot, no pv surplus' };
  }
  if (!futureDeficit) {
    return { power: 0, reason: 'no future deficit, no pv surplus' };
  }

  return { power: config.maxChargeRate, reason: 'cheap energy available' };
}

function shouldDischargeNow(
  currentSlot: number,
  mostExpensiveSlots: number[],
  current: SimulationDataPoint,
  config: BatteryConfig,
  relayState: boolean,
  forecast: SimulationDataPoint[]
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
    effectiveConsumption += config.relayNominalPower;
  }
  
  const deficit = Math.max(0, effectiveConsumption - current.pvGeneration);

  if (deficit <= 0) {
    return { power: 0, reason: 'no deficit to cover' };
  }

  // Determine energy that must remain for upcoming expensive consumption
  const futureNeed = forecast.slice(1, 13).reduce((sum, slot) => {
    if (slot.consumptionPrice > current.injectionPrice) {
      const d = Math.max(0, slot.consumption - slot.pvForecast);
      return sum + d * 0.25;
    }
    return sum;
  }, 0);

  const socEnergy = (current.soc / 100) * config.batteryCapacity;
  const minEnergy = (config.minSoc / 100) * config.batteryCapacity;
  const allowedEnergy = socEnergy - minEnergy - futureNeed;

  const maxPower = Math.min(deficit, config.maxDischargeRate, allowedEnergy / 0.25);

  if (maxPower <= 0) {
    return { power: 0, reason: 'reserve for future expensive consumption' };
  }

  // Only discharge what's actually needed, up to allowed power
  return { power: maxPower, reason: 'cover consumption' };
}
