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

  let decision: ControlDecision = {
    batteryPower: 0,
    curtailment: 0,
    loadState: false,
    loadDecisionReason: '',
    batteryDecision: 'hold',
    batteryDecisionReason: '',
  };

  // Charging logic
  const chargeDecision = shouldChargeNow(currentSlot, current, config, forecast);
  if (chargeDecision.power > 0) {
    decision.batteryPower = chargeDecision.power;
    decision.batteryDecision = 'charge';
    decision.batteryDecisionReason = chargeDecision.reason;
  }
  // Discharging logic
  else {
    const dischargeDecision = shouldDischargeNow(
      currentSlot,
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



function shouldChargeNow(
  currentSlot: number,
  current: SimulationDataPoint,
  config: BatteryConfig,
  forecast: SimulationDataPoint[]
): { power: number; reason: string } {
  if (current.soc >= config.maxSoc) {
    return { power: 0, reason: 'battery full' };
  }

  // --- Blok: Vooruitkijken naar toekomstige tekorten en bepalen of laden nodig is ---
  // Kijk 6 uur vooruit (24 kwartieren)
  const lookahead = forecast.slice(1, 25);
  const availableCapacity =
    ((config.maxSoc - current.soc) / 100) * config.batteryCapacity;

  let pvSurplusEnergy = 0; // kWh reeds verwacht voor een tekort
  let futureDeficit = 0;   // energie die moet worden bijgeladen (kWh)

  // Verzamel slots tot aan (maar exclusief) de eerste slot met een goedkopere prijs
  const slotsUntilCheaper = [];
  const slotsUntilMoreExpensive = [];
  for (const s of lookahead) {
    if (s.consumptionPrice < current.consumptionPrice) break;
    slotsUntilCheaper.push(s);
  }
  for (const s of lookahead) {
    if (s.consumptionPrice > current.consumptionPrice) break;
    slotsUntilMoreExpensive.push(s);
  }

  // Als er geen slot is met een duurdere prijs in de lookahead, hoeft de batterij niet opgeladen te worden
  if (slotsUntilMoreExpensive.length === lookahead.length) {
    // Er is geen duurdere slot gevonden in de lookahead
    // Dus: niet laden voor toekomstige tekorten, want het wordt niet duurder
    // (futureDeficit blijft 0)
  } else {
    // Bereken het totale tekort aan energie (consumptie - pvForecast) over deze slots
    let totalDeficit = 0;
    let pvSurplusBuffer = pvSurplusEnergy;
    for (const s of slotsUntilCheaper) {
      const net = s.consumption - s.pvForecast;
      if (net <= 0) {
        // PV overschot, buffer het.
        // We gebruiken Math.min om te zorgen dat de buffer nooit groter wordt dan de beschikbare batterijcapaciteit.
        // Dit voorkomt dat we meer energie in de buffer stoppen dan de batterij aankan.
        pvSurplusBuffer = Math.min(
          pvSurplusBuffer + (-net) * 0.25,
          availableCapacity
        );
      } else {
        // Tekort, compenseer met buffer
        const needed = Math.max(0, net * 0.25 - pvSurplusBuffer);
        pvSurplusBuffer = Math.max(0, pvSurplusBuffer - net * 0.25);
        totalDeficit += needed;
      }
    }

    if (totalDeficit > 0) {
      // Houd rekening met wat reeds in de batterij zit: bereken hoeveel extra er nog moet worden opgeladen
      // Beschikbare energie in batterij (boven minSoc)
      const energyInBattery = ((current.soc - config.minSoc) / 100) * config.batteryCapacity;

      const utc2Time = new Date(current.time.getTime() + 2 * 60 * 60 * 1000);
      console.log(
        `${utc2Time.toISOString()} totalDeficit: ${totalDeficit.toFixed(4)}, availableCapacity: ${availableCapacity.toFixed(4)}, energyInBattery: ${energyInBattery.toFixed(4)}`
      );

      // Enkel bijladen tot er genoeg in de batterij zit voor het toekomstige tekort
      // Bepaal extraNeeded als het minimum van (totalDeficit - energyInBattery) en availableCapacity, maar nooit negatief
      const extraNeeded = Math.max(0, Math.min(totalDeficit - energyInBattery, availableCapacity));
      futureDeficit = extraNeeded;
    }
  }

  if (futureDeficit > 0) {
    return {
      power: Math.min(futureDeficit / 0.25, config.maxChargeRate),
      reason: `Laad bij voor toekomstig tekort van ${futureDeficit.toFixed(2)} kWh (saldo komende 6 uur)`
    };
  }
  // --- Einde blok: Vooruitkijken naar toekomstige tekorten ---


  const pvSurplus = current.pvGeneration - current.consumption;
  if (pvSurplus > 0) {
    return {
      power: Math.min(pvSurplus, config.maxChargeRate),
      reason: 'pv surplus',
    };
  }

  if (!futureDeficit) {
    return { power: 0, reason: 'no future deficit, no pv surplus' };
  }

  return { power: config.maxChargeRate, reason: 'cheap energy available' };
}

function shouldDischargeNow(
  currentSlot: number,
  current: SimulationDataPoint,
  config: BatteryConfig,
  loadState: boolean,
  forecast: SimulationDataPoint[]
): { power: number; reason: string } {
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
