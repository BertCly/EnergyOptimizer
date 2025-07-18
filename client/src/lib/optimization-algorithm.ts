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
    batteryDecisionReason: '',
    curtailmentDecisionReason: '',
  };

  // Charging logic
  const chargeDecision = shouldChargeNow(currentSlot, current, config, forecast);
  if (chargeDecision.power > 0) {
    decision.batteryPower = chargeDecision.power;
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
      decision.batteryDecisionReason = `Charge decision: ${chargeDecision.reason}<br />Discharge decision: ${dischargeDecision.reason}`;
    } else {
      // when holding, pick reason from dischargeDecision or chargeDecision
      decision.batteryDecisionReason = `Charge decision: ${chargeDecision.reason}<br />Discharge decision: ${dischargeDecision.reason}`;
    }
  }

  // Controllable load logic
  const loadDecision = determineLoadState(currentSlot, data, decision.batteryPower, config, current);
  decision.loadState = loadDecision.state;
  decision.loadDecisionReason = loadDecision.reason;

  // PV curtailment logic
  const curtailmentResult = calculatePvCurtailment(current, decision, config);
  decision.curtailment = curtailmentResult.curtailment;
  decision.curtailmentDecisionReason = curtailmentResult.reason;

  // Apply grid capacity limits
  decision = applyGridCapacityLimits(current, decision, config);

  return decision;
}



/**
 * Bepaalt of de batterij nu moet opladen, en zo ja, hoeveel vermogen.
 *
 * @param currentSlot - Huidige tijdslot index
 * @param current - Huidige simulatiepunt
 * @param config - Batterijconfiguratie
 * @param forecast - Array van toekomstige simulatiepunten (inclusief huidige)
 * @returns { power: number, reason: string }
 */
function shouldChargeNow(
  currentSlot: number,
  current: SimulationDataPoint,
  config: BatteryConfig,
  forecast: SimulationDataPoint[]
): { power: number; reason: string } {
  // --- Blok 1: Maximale SoC-check ---
  if (current.soc >= config.maxSoc) {
    return { power: 0, reason: 'battery full' };
  }

  // --- Blok 2: Negatieve prijs-check ---
  // Laad altijd maximaal als de consumptieprijs negatief is
  if (current.consumptionPrice < 0) {
    return {
      power: config.maxChargeRate,
      reason: 'negative price: charge as much as possible'
    };
  }

  // --- Blok 3: Vooruitkijken naar toekomstige tekorten en bepalen of laden nodig is ---
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

      // Enkel bijladen tot er genoeg in de batterij zit voor het toekomstige tekort
      // Bepaal extraNeeded als het minimum van (totalDeficit - energyInBattery) en availableCapacity, maar nooit negatief
      const extraNeeded = Math.max(0, Math.min(totalDeficit - energyInBattery, availableCapacity));
      futureDeficit = extraNeeded;
    }
  }

  if (futureDeficit > 0) {
    return {
      power: Math.min(futureDeficit / 0.25, config.maxChargeRate),
      reason: `charge for future deficit of ${futureDeficit.toFixed(2)} kWh (next 6h balance)`
    };
  }
  // --- Einde blok 3: Vooruitkijken naar toekomstige tekorten ---

  // --- Blok 4: PV-overschot ---
  const pvSurplus = current.pvGeneration - current.consumption;
  if (pvSurplus > 0) {
    return {
      power: Math.min(pvSurplus, config.maxChargeRate),
      reason: 'pv surplus',
    };
  }

  return { power: 0, reason: 'no future deficit, no pv surplus' };
}

/**
 * Bepaalt of de batterij nu moet ontladen, en zo ja, hoeveel vermogen.
 * 
 * @param currentSlot - Huidige tijdslot index
 * @param current - Huidige simulatiepunt
 * @param config - Batterijconfiguratie
 * @param loadState - Of de load actief is (momenteel niet gebruikt)
 * @param forecast - Array van toekomstige simulatiepunten (inclusief huidige)
 * @returns { power: number, reason: string }
 */
function shouldDischargeNow(
  currentSlot: number,
  current: SimulationDataPoint,
  config: BatteryConfig,
  loadState: boolean,
  forecast: SimulationDataPoint[]
): { power: number; reason: string } {
  // 0. Beschikbaarheid batterij-energie controleren
  if (current.soc <= config.minSoc) {
    return { power: 0, reason: 'battery empty' };
  }

  // 1. Niet ontladen als de prijs negatief is
  if (current.consumptionPrice < 0) {
    return { power: 0, reason: 'discharging not allowed at negative price' };
  }

  // --- Blok 3: Bepaal huidig tekort en reserveer voor toekomstige dure uren ---
  // Bepaal huidig tekort (consumptie - PV)
  const effectiveConsumption = current.consumption;
  const deficit = Math.max(0, effectiveConsumption - current.pvGeneration);

  if (deficit <= 0) {
    return { power: 0, reason: 'no deficit to cover' };
  }

  // Kijk vooruit: reserveer energie voor dure uren in de komende 3 uur (12 slots)
  const lookahead = forecast.slice(1, 13); // slots 1 t/m 12 na nu
  let futureDeficit = 0;    // Totale verwachte dure tekorten (kWh)
  let expectedCharge = 0;   // Verwachte toekomstige lading uit PV (kWh)

  for (const slot of lookahead) {
    // Tel alleen tekorten bij als de prijs in de toekomst hoger is dan nu
    if (slot.consumptionPrice > current.consumptionPrice) {
      const slotDeficit = Math.max(0, slot.consumption - slot.pvForecast);
      futureDeficit += slotDeficit * 0.25;
    }
    // Verwachte lading uit PV-overschot meenemen
    if (slot.pvForecast > slot.consumption) {
      const surplus = Math.min(slot.pvForecast - slot.consumption, config.maxChargeRate);
      expectedCharge += surplus * 0.25;
    }
  }

  // Bepaal hoeveel van de batterij nog bruikbaar is (boven minSoc)
  const availableCapacity = ((config.maxSoc - current.soc) / 100) * config.batteryCapacity;
  // Bepaal hoeveel energie we moeten reserveren voor toekomstige dure tekorten
  //    (rekening houdend met verwachte lading uit PV)
  const futureNeed = Math.max(0, futureDeficit - Math.min(expectedCharge, availableCapacity));

  // Bepaal hoeveel energie we nu maximaal mogen ontladen
  const socEnergy = (current.soc / 100) * config.batteryCapacity;
  const minEnergy = (config.minSoc / 100) * config.batteryCapacity;
  const allowedEnergy = socEnergy - minEnergy - futureNeed;

  // Bepaal maximaal toelaatbaar ontlaadvermogen
  const maxPower = Math.min(deficit, config.maxDischargeRate, allowedEnergy / 0.25);

  if (maxPower <= 0) {
    return { power: 0, reason: 'reserve for future expensive consumption' };
  }

  // Ontlaad alleen wat nodig is, tot het maximum
  return { 
    power: maxPower, 
    reason: `cover consumption (deficit: ${deficit.toFixed(2)} kW, allowed: ${allowedEnergy.toFixed(2)} kWh, futureNeed: ${futureNeed.toFixed(2)} kWh)`
  };
}

/**
 * Bepaalt of de aanstuurbare load (apparaat) aan of uit moet zijn in het huidige tijdslot.
 *
 * Nieuwe logica:
 * 1. Kijk vooruit tot aan de deadline en tel het aantal slots met PV-overschot >= activation power.
 * 2. Bepaal hoeveel extra slots de load nog moet draaien volgens min runtime per dag.
 * 3. Activeer de load in de goedkoopste tijdsloten van de dag als er nog slots nodig zijn.
 *
 * @param currentSlot - Index van het huidige tijdslot
 * @param data - Array van alle simulatiepunten tot nu toe
 * @param batteryPower - Huidige batterijvermogen (kW)
 * @param config - Instellingen voor batterij en load
 * @param current - Huidig simulatiepunt
 * @returns { state: boolean, reason: string } - Of de load aan moet zijn en de reden
 */
function determineLoadState(
  currentSlot: number,
  data: SimulationDataPoint[],
  batteryPower: number,
  config: BatteryConfig,
  current: SimulationDataPoint
): { state: boolean; reason: string } {
  // Was de load in de vorige stap actief?
  const prevLoad = currentSlot > 0 ? data[currentSlot - 1].loadState : false;

  // Hoe lang is de load al aaneengesloten actief?
  let activationRuntime = 0;
  if (prevLoad) {
    for (let i = currentSlot - 1; i >= 0 && data[i].loadState; i--) {
      activationRuntime += 0.25;
    }
  }

  // Hoeveel uur is de load vandaag al actief geweest?
  let runtimeTillNow = 0;
  for (let i = 0; i < currentSlot; i++) {
    if (data[i].loadState) runtimeTillNow += 0.25;
  }

  // Huidige tijd en deadline berekenen
  const currentHour = current.time.getHours();
  const currentMinute = current.time.getMinutes();
  const slotsPerHour = 4;
  const deadlineHour = config.loadRuntimeDeadlineHour;

  // Bepaal de dag van vandaag (zodat we alleen naar vandaag kijken)
  const today = new Date(current.time);
  today.setHours(0, 0, 0, 0);

  // Verzamel alle slots van vandaag tot aan de deadline
  const slotsToday: { index: number; point: SimulationDataPoint }[] = [];
  for (let i = 0; i < data.length; i++) {
    const slotTime = data[i].time;
    const slotHour = slotTime.getHours();
    const slotMinute = slotTime.getMinutes();
    // Alleen slots van vandaag
    const slotDay = new Date(slotTime);
    slotDay.setHours(0, 0, 0, 0);
    if (slotDay.getTime() !== today.getTime()) continue;
    // Alleen slots tot aan de deadline (laatste slot eindigt op deadlineHour - 0.25h)
    if (slotHour < deadlineHour || (slotHour === deadlineHour && slotMinute === 0)) {
      // slot mag meedoen
      slotsToday.push({ index: i, point: data[i] });
    }
  }

  // Kijk vooruit vanaf currentSlot tot aan de deadline
  const futureSlots = slotsToday.filter(s => s.index >= currentSlot);

  // 1. Tel het aantal slots met PV-overschot >= activation power
  const pvOversupplySlots: number[] = [];
  for (const { index, point } of futureSlots) {
    // Bepaal oversupply na batterij (gebruik 0 voor batteryPower in toekomst)
    const oversupply = point.pvGeneration - point.consumption - Math.max(0, 0);
    if (oversupply >= config.loadActivationPower) {
      pvOversupplySlots.push(index);
    }
  }

  // 2. Bepaal hoeveel extra slots de load nog moet draaien volgens min runtime per dag
  const minSlotsNeeded = Math.max(0, (config.loadMinRuntimeDaily - runtimeTillNow) / 0.25);

  // 3. Selecteer de goedkoopste tijdsloten van vandaag tot aan de deadline
  //    (exclusief slots waar load al aan stond)
  //    We nemen alle slots van vandaag tot deadline, sorteren op prijs, en pakken de goedkoopste
  //    die nog niet aan stonden, tot minSlotsNeeded is bereikt.
  //    (Als pvOversupplySlots >= minSlotsNeeded, dan alleen die slots gebruiken.)

  // Verzamel alle slots van vandaag tot deadline die nog niet voorbij zijn
  const candidateSlots = futureSlots.map(({ index, point }) => ({
    index,
    price: point.consumptionPrice,
    pvOversupply: (point.pvGeneration - point.consumption) >= config.loadActivationPower,
  }));

  // Sorteer op prijs (goedkoopste eerst)
  candidateSlots.sort((a, b) => a.price - b.price);

  // Selecteer slots met PV-overschot eerst, daarna goedkoopste slots
  let selectedSlots: number[] = [];
  if (pvOversupplySlots.length >= minSlotsNeeded) {
    // Genoeg PV-overschot slots, kies de eerste minSlotsNeeded
    selectedSlots = pvOversupplySlots.slice(0, minSlotsNeeded);
  } else {
    // Neem alle PV-overschot slots, vul aan met goedkoopste slots
    selectedSlots = [...pvOversupplySlots];
    for (const slot of candidateSlots) {
      if (
        selectedSlots.length >= minSlotsNeeded
      ) break;
      if (!selectedSlots.includes(slot.index)) {
        selectedSlots.push(slot.index);
      }
    }
  }

  // Check 2: Moet de load aan omwille van minimale runtime per activatie?
  const needMinActivation = prevLoad && activationRuntime < config.loadMinRuntimeActivation;

  // Check 3: Moet de load aan omwille van negatieve consumptieprijs?
  const negativeConsumptionPrice = current.consumptionPrice < 0;

  let load = prevLoad;
  let reason = '';

  // Prioriteit 0: Indien de consumptieprijs negatief is, moet de load aan
  if (negativeConsumptionPrice) {
    load = true;
    reason = 'negative consumption price';
  }
  // Prioriteit 1: Min runtime per activatie
  else if (needMinActivation) {
    load = true;
    reason = 'minimum activation runtime';
  }
  // Prioriteit 2: Moet de load aan omwille van min runtime per dag, en is dit een geselecteerd slot?
  else if (selectedSlots.includes(currentSlot) && minSlotsNeeded > 0) {
    load = true;
    if (pvOversupplySlots.includes(currentSlot)) {
      reason = 'pv oversupply (selected for min daily runtime)';
    } else {
      reason = 'selected for min daily runtime (cheapest slot)';
    }
  }
  // Anders: load uit
  else {
    load = false;
    reason = 'not selected for min daily runtime';
  }

  return { state: load, reason };
}

function calculatePvCurtailment(
  current: SimulationDataPoint,
  decision: ControlDecision,
  config: BatteryConfig
): { curtailment: number; reason: string } {
  if (current.consumptionPrice < 0) {
    return { curtailment: current.pvGeneration, reason: 'negative consumption price' };
  }

  if (current.injectionPrice < 0) {
    let effectiveConsumption = current.consumption + decision.batteryPower;
    if (decision.loadState) {
      effectiveConsumption += config.loadNominalPower;
    }
    const excess = Math.max(0, current.pvGeneration - effectiveConsumption);
    return { curtailment: excess, reason: 'negative injection price' };
  }

  return { curtailment: 0, reason: 'no curtailment needed' };
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
  config: BatteryConfig
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
