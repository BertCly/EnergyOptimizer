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
    loadState: false,
    loadDecisionReason: '',
    batteryDecision: 'hold',
    batteryDecisionReason: '',
  };

  // Charging logic
  const chargeDecision = shouldChargeNow(currentSlot, cheapestSlots, current, config, forecast);
  if (chargeDecision.power > 0) {
    decision.batteryPower = chargeDecision.power;
    decision.batteryDecision = 'charge';
    decision.batteryDecisionReason = chargeDecision.reason;
  }
  // Discharging logic
  else {
    const dischargeDecision = shouldDischargeNow(
      currentSlot,
      mostExpensiveSlots,
      current,
      config,
      decision.loadState,
      forecast
    );
    if (dischargeDecision.power > 0) {
      decision.batteryPower = -dischargeDecision.power;
      decision.batteryDecision = 'discharge';
      decision.batteryDecisionReason = `Charge decision: ${chargeDecision.reason}\nDischarge decision: ${dischargeDecision.reason}`;
    } else {
      // when holding, pick reason from dischargeDecision or chargeDecision
      decision.batteryDecisionReason = `Charge decision: ${chargeDecision.reason}\nDischarge decision: ${dischargeDecision.reason}`;
    }
  }

  // Controllable load logic
  const loadDecision = determineLoadState(currentSlot, data, decision.batteryPower, config, current);
  decision.loadState = loadDecision.state;
  decision.loadDecisionReason = loadDecision.reason;

  // PV curtailment logic
  decision.curtailment = calculatePvCurtailment(current, decision, config);

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
  loadState: boolean,
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
  
  // Add controllable load consumption when load is ON
  if (loadState) {
    effectiveConsumption += config.loadNominalPower;
  }
  
  const deficit = Math.max(0, effectiveConsumption - current.pvGeneration);

  if (deficit <= 0) {
    return { power: 0, reason: 'no deficit to cover' };
  }

  // Determine energy that must remain for upcoming expensive consumption (3 hours)
  const lookahead = forecast.slice(1, 13);
  let futureDeficit = 0;
  let expectedCharge = 0;

  for (const slot of lookahead) {
    if (slot.consumptionPrice > current.consumptionPrice) {
      const deficit = Math.max(0, slot.consumption - slot.pvForecast);
      futureDeficit += deficit * 0.25;
    }

    if (slot.pvForecast > slot.consumption) {
      const surplus = Math.min(slot.pvForecast - slot.consumption, config.maxChargeRate);
      expectedCharge += surplus * 0.25;
    }
  }

  const availableCapacity = ((config.maxSoc - current.soc) / 100) * config.batteryCapacity;
  const futureNeed = Math.max(0, futureDeficit - Math.min(expectedCharge, availableCapacity));

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

function determineLoadState(
  currentSlot: number,
  data: SimulationDataPoint[],
  batteryPower: number,
  config: BatteryConfig,
  current: SimulationDataPoint
): { state: boolean; reason: string } {
  const prevLoad = currentSlot > 0 ? data[currentSlot - 1].loadState : false;

  let activationRuntime = 0;
  if (prevLoad) {
    for (let i = currentSlot - 1; i >= 0 && data[i].loadState; i--) {
      activationRuntime += 0.25;
    }
  }

  let dailyRuntime = 0;
  for (let i = 0; i < currentSlot; i++) {
    if (data[i].loadState) dailyRuntime += 0.25;
  }

  const oversupply = current.pvGeneration - current.consumption - Math.max(batteryPower, 0);
  const gridImport = Math.max(0, current.consumption + Math.max(batteryPower, 0) - current.pvGeneration);
  const needDailyRuntime =
    current.time.getHours() >= config.loadRuntimeDeadlineHour &&
    dailyRuntime < config.loadMinRuntimeDaily;

  let load = prevLoad;
  let reason = '';
  if (load) {
    activationRuntime += 0.25;
    if (activationRuntime >= config.loadMinRuntimeActivation && !needDailyRuntime) {
      if (config.loadActivationPower >= config.loadNominalPower) {
        if (oversupply < config.loadNominalPower) {
          load = false;
          reason = 'pv oversupply insufficient';
        } else {
          reason = 'pv oversupply';
        }
      } else {
        if (gridImport > config.loadNominalPower - config.loadActivationPower) {
          load = false;
          reason = 'grid import too high';
        } else {
          reason = 'grid import low';
        }
      }
    } else {
      reason = needDailyRuntime ? 'daily runtime required' : 'minimum runtime';
    }
  } else {
    if (oversupply >= config.loadActivationPower || needDailyRuntime) {
      load = true;
      reason = needDailyRuntime ? 'daily runtime required' : 'pv oversupply';
    } else {
      reason = 'insufficient oversupply';
    }
  }

  return { state: load, reason };
}

function calculatePvCurtailment(
  current: SimulationDataPoint,
  decision: ControlDecision,
  config: BatteryConfig
): number {
  if (current.consumptionPrice < 0) {
    return current.pvGeneration;
  }

  if (current.injectionPrice < 0) {
    let effectiveConsumption = current.consumption + decision.batteryPower;
    if (decision.loadState) {
      effectiveConsumption += config.loadNominalPower;
    }
    const excess = Math.max(0, current.pvGeneration - effectiveConsumption);
    return excess;
  }

  return 0;
}
