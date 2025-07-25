import { SiteEnergyConfig, SimulationDataPoint, ControlDecision } from "@shared/schema";
import { getPreviousLoadState, getActivationRuntime, getTodayRuntime, storeLoadState } from "../storage";
import { 
  getPvInverterGeneration, 
  getAffordablePvGeneration, 
  getExpensivePvGeneration
} from "../optimization-algorithm";

/**
 * Cost optimization control cycle algorithm
 * Uses price-based logic to optimize costs
 */
export function costOptimizationControlCycle(
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
  const loadDecision = determineLoadState(currentSlot, decision.batteryPower, config, current, forecast);
  decision.loadState = loadDecision.state;
  decision.loadDecisionReason = loadDecision.reason;
  
  // Store the load state for future reference
  storeLoadState(currentSlot, decision.loadState);

  // PV setpoint logic
  const setpointResult = calculatePvSetpoint(current, decision, config);
  decision.pvActivePowerSetpoint = setpointResult.setpoint;
  decision.curtailmentDecisionReason = setpointResult.reason;

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
  config: SiteEnergyConfig,
  forecast: SimulationDataPoint[]
): { power: number; reason: string } {
  // --- Blok 0: Trading Signal Check ---
  if (config.tradingSignalEnabled) {
    switch (current.tradingSignal) {
      case "standby":
        return { power: 0, reason: 'trading signal: standby - battery idle' };
      case "overrule":
        const requestedPower = current.tradingSignalRequestedPower;
        if (requestedPower > 0) {
          // Charging requested
          const maxChargePower = Math.min(requestedPower, config.maxChargeRate);
          if (current.soc >= config.maxSoc) {
            return { power: 0, reason: 'trading signal: overrule - cannot charge, battery full' };
          }
          return { 
            power: maxChargePower, 
            reason: `trading signal: overrule - charging ${maxChargePower.toFixed(2)} kW (requested: ${requestedPower.toFixed(2)} kW)` 
          };
        } else if (requestedPower < 0) {
          // Discharging requested - handled in shouldDischargeNow
          return { power: 0, reason: 'trading signal: overrule - discharging requested (handled in discharge logic)' };
        } else {
          // No power requested
          return { power: 0, reason: 'trading signal: overrule - no power requested' };
        }
      case "local":
        // Continue with normal optimization logic
        break;
    }
  }

  // --- Blok 1: Maximale SoC-check ---
  if (current.soc >= config.maxSoc) {
    return { power: 0, reason: 'battery full' };
  }

  // --- Blok 2: Negatieve prijs-check ---
  // Optimaliseer lading over negatieve prijsslots
  if (current.consumptionPrice < 0) {
    return optimizeNegativePriceCharging(current, config, forecast);
  }

  // --- Blok 2.5: Voorkom laden als er een negatieve consumptieprijs aankomt ---
  // Bepaal lookahead horizon voor negatieve prijzen
  const lookaheadSlots = getNegativePriceLookaheadHorizon(current, config, forecast);

  // Zoek het eerste slot met negatieve consumptieprijs binnen deze horizon
  let negSlot = -1;
  for (let i = 1; i <= lookaheadSlots; i++) {
    if (forecast[i].consumptionPrice < 0) {
      negSlot = i;
      break;
    }
  }

  // Als er een negatieve consumptieprijs aankomt, niet laden
  if (negSlot > 0) {
    return { 
      power: 0, 
      reason: `do not charge: negative consumption price coming in slot +${negSlot}` 
    };
  }

  // --- Blok 3: Vooruitkijken naar toekomstige tekorten en bepalen of laden nodig is ---
  // Kijk 8 uur vooruit (32 kwartieren)
  const lookahead = forecast.slice(1, 33);
  const availableCapacity =
    ((config.maxSoc - current.soc) / 100) * config.batteryCapacity;

  let pvSurplusEnergy = 0; // kWh reeds verwacht voor een tekort
  let extraNeededForFutureDeficit = 0;   // energie die moet worden bijgeladen (kWh)

  // Bereken effectieve prijs voor laden rekening houdend met round-trip efficiency
  const effectiveChargePrice = current.consumptionPrice / config.batteryRoundTripEfficiency;
  
  // Bepaal welke slots we gebruiken om moreExpensiveSlots te zoeken
  const slotsToCheck = (() => {
    // Als het eerste slot al goedkoper is, dan geen provisie nodig
    if (lookahead.length > 0 && lookahead[0].consumptionPrice < current.consumptionPrice) {
      return [];
    }
    
    // Verzamel slots tot aan (maar exclusief) de eerste slot met een goedkopere prijs
    const slotsUntilCheaper = [];
    for (const slot of lookahead) {
      if (slot.consumptionPrice < current.consumptionPrice) break;
      slotsUntilCheaper.push(slot);
    }
    
    // Als er duurdere slots zijn gevonden, gebruik die. Anders gebruik de hele lookahead
    return slotsUntilCheaper.length > 0 ? slotsUntilCheaper : lookahead;
  })();

  // Filter uit slotsToCheck de slots die voldoende duurder zijn dan de effectieve laadprijs
  const moreExpensiveSlots = [];
  for (const s of slotsToCheck) {
    const priceDifference = s.consumptionPrice - effectiveChargePrice;
    if (priceDifference >= config.batteryMinPriceDifference) {
      moreExpensiveSlots.push(s);
    }
  }

  // Als er geen slots zijn die duurder zijn dan de effectieve laadprijs, hoeft de batterij niet opgeladen te worden
  if (moreExpensiveSlots.length === 0) {
    // Er zijn geen slots gevonden die duurder zijn dan de effectieve laadprijs
    // Dus: niet laden voor toekomstige tekorten, want het wordt niet duurder
    // (extraNeededForFutureDeficit blijft 0)
  } else {
    // Bereken het totale tekort aan energie (consumptie - pvForecast) over de winstgevende slots
    let totalDeficit = 0;
    let pvSurplusBuffer = pvSurplusEnergy;
    for (const s of moreExpensiveSlots) {
      const net = s.consumption - s.pvForecast;
      if (net <= 0) {
        // PV overschot, buffer het.
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
      extraNeededForFutureDeficit = Math.max(0, Math.min(totalDeficit - energyInBattery, availableCapacity));
      
      // Bepaal hoeveel vermogen er in dit slot moet worden geladen, rekening houdend met spreiding
      const chargePower = calculateSpreadChargePower(
        extraNeededForFutureDeficit,
        current,
        forecast,
        config
      );
      
      return {
        power: chargePower,
        reason: `charge for future deficit of ${extraNeededForFutureDeficit.toFixed(2)} kWh (covering until ${(() => {
          const lastSlot = moreExpensiveSlots[moreExpensiveSlots.length - 1];
          if (!lastSlot) return '';
          const endTime = new Date(lastSlot.time.getTime() + 15 * 60 * 1000); // add 15 minutes
          return endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        })()})`
      };
    }
  }
  // --- Einde blok 3: Vooruitkijken naar toekomstige tekorten ---

  // --- Blok 4: PV-overschot (alleen betaalbare PV) ---
  // Converteer consumptieprijs van €/kWh naar €/MWh voor vergelijking
  const consumptionPricePerMWh = current.consumptionPrice;
  
  // Gebruik alleen PV generatie van omvormers met prijs lager dan huidige consumptieprijs
  const affordablePvGeneration = getAffordablePvGeneration(current, config, consumptionPricePerMWh);
  const expensivePvGeneration = getExpensivePvGeneration(current, config, consumptionPricePerMWh);
  const pvSurplus = affordablePvGeneration - current.consumption;
  
  if (pvSurplus > 0) {
    let reason = `pv surplus (affordable PV: ${affordablePvGeneration.toFixed(1)}kW)`;
    
    // Als er dure PV is die niet wordt gebruikt, voeg dat toe aan de reden
    if (expensivePvGeneration > 0) {
      reason += `, expensive PV not used: ${expensivePvGeneration.toFixed(1)}kW`;
    }
    
    return {
      power: Math.min(pvSurplus, config.maxChargeRate),
      reason: reason,
    };
  }

  // Samengevoegde return voor geen PV surplus
  const totalPvGeneration = current.pvGeneration;
  let reason = 'no negative prices, no future deficit';
  
  // Voeg informatie toe over dure PV die niet wordt gebruikt
  if (totalPvGeneration > 0 && affordablePvGeneration === 0 && expensivePvGeneration > 0) {
    reason += `, no affordable PV available (expensive PV: ${expensivePvGeneration.toFixed(1)}kW)`;
  } else {
    reason += ', no pv surplus'
  }
  
  return { power: 0, reason: reason };
}

/**
 * Berekent de effectieve consumptie inclusief de controllable load
 * 
 * @param slot - Simulatiepunt
 * @param config - Site configuratie
 * @returns Effectieve consumptie in kW
 */
function getEffectiveConsumption(slot: SimulationDataPoint, config: SiteEnergyConfig): number {
  let effectiveConsumption = slot.consumption;
  
  // Voeg controllable load toe als deze is ingesteld
  if (config.loadNominalPower > 0) {
    effectiveConsumption += config.loadNominalPower;
  }
  
  return effectiveConsumption;
}

/**
 * Optimaliseert lading over negatieve prijsslots door vooruit te kijken
 * en de lading te verspreiden over de goedkoopste slots.
 * 
 * @param current - Huidige simulatiepunt
 * @param config - Batterijconfiguratie
 * @param forecast - Array van toekomstige simulatiepunten
 * @returns { power: number, reason: string }
 */
function optimizeNegativePriceCharging(
  current: SimulationDataPoint,
  config: SiteEnergyConfig,
  forecast: SimulationDataPoint[]
): { power: number; reason: string } {
  // Zoek alle slots met negatieve prijzen (inclusief huidige slot)
  const negativePriceSlots: { index: number; price: number; slot: SimulationDataPoint }[] = [];
  
  // Voeg huidige slot toe als het een negatieve prijs heeft
  if (current.consumptionPrice < 0) {
    negativePriceSlots.push({
      index: 0,
      price: current.consumptionPrice,
      slot: current
    });
  }
  
  // Kijk vooruit tot we een positieve prijs tegenkomen of maximaal 8 uur (32 kwartieren)
  const maxLookahead = Math.min(32, forecast.length - 1);
  
  for (let i = 1; i <= maxLookahead; i++) {
    const slot = forecast[i];
    if (slot.consumptionPrice < 0) {
      negativePriceSlots.push({
        index: i,
        price: slot.consumptionPrice,
        slot: slot
      });
    } else {
      // Stop zoeken zodra we een positieve prijs tegenkomen
      break;
    }
  }
  
  // Sorteer slots op prijs (laagste eerst - meest negatief)
  negativePriceSlots.sort((a, b) => a.price - b.price);
  
  // Bereken beschikbare batterijcapaciteit
  const availableCapacity = ((config.maxSoc - current.soc) / 100) * config.batteryCapacity;
  
  // Groepeer slots per prijs
  const priceGroups: { price: number; slots: typeof negativePriceSlots }[] = [];
  let currentGroup: typeof negativePriceSlots = [];
  let currentPrice = negativePriceSlots[0].price;
  
  for (const slot of negativePriceSlots) {
    if (Math.abs(slot.price - currentPrice) < 1) { // Kleine tolerantie //TODO: verhogen
      currentGroup.push(slot);
    } else {
      if (currentGroup.length > 0) {
        priceGroups.push({ price: currentPrice, slots: currentGroup });
      }
      currentGroup = [slot];
      currentPrice = slot.price;
    }
  }
  
  // Voeg laatste groep toe
  if (currentGroup.length > 0) {
    priceGroups.push({ price: currentPrice, slots: currentGroup });
  }
  
  // Verdeel lading over slots, beginnend met goedkoopste prijs
  let remainingEnergy = availableCapacity;
  let currentSlotPower = 0;
  let usedSlots: number[] = []; 
  
  for (const group of priceGroups) {
    if (remainingEnergy <= 0) break;
    
    // Bereken totale beschikbare capaciteit voor deze prijsgroep
    let groupGridCapacity = 0;
    for (const slot of group.slots) {
      const effectiveConsumption = getEffectiveConsumption(slot.slot, config);
      // Bij negatieve prijzen wordt PV 100% gecurtailed, dus niet aftrekken
      const netConsumption = effectiveConsumption;
      const availableGridCapacity = Math.max(0, config.gridCapacityImportLimit - netConsumption);
      groupGridCapacity += availableGridCapacity;
    }
    
    // Bereken hoeveel energie we kunnen laden in deze prijsgroep
    const groupEnergy = Math.min(remainingEnergy, groupGridCapacity * 0.25);
    
    // Verdeel energie proportioneel over slots in deze groep
    for (const slot of group.slots) {
      if (groupEnergy <= 0) break;
      
      const effectiveConsumption = getEffectiveConsumption(slot.slot, config);
      // Bij negatieve prijzen wordt PV 100% gecurtailed, dus niet aftrekken
      const netConsumption = effectiveConsumption;
      const availableGridCapacity = Math.max(0, config.gridCapacityImportLimit - netConsumption);
      const proportionalEnergy = (availableGridCapacity / groupGridCapacity) * groupEnergy;
      const slotEnergy = Math.min(proportionalEnergy, availableGridCapacity * 0.25);
      
      // Converteer naar vermogen
      const slotPower = slotEnergy / 0.25;
      
      // Beperk tot maxChargeRate
      const limitedSlotPower = Math.min(slotPower, config.maxChargeRate);
      
      // Als dit het huidige slot is (index 0), sla het vermogen op
      if (slot.index === 0) {
        currentSlotPower = limitedSlotPower;
      }
      
      usedSlots.push(slot.index);
      remainingEnergy -= limitedSlotPower * 0.25;
    }
  }
  
  // Als er geen lading in huidige slot is gepland, geef reden
  if (currentSlotPower <= 0) {
    const cheapestPrice = priceGroups[0]?.price || 0;
    const cheapestSlotCount = priceGroups[0]?.slots.length || 0;
    return {
      power: 0,
      reason: `negative price: defer charging to ${cheapestSlotCount} slots with price ${cheapestPrice.toFixed(2)} €/MWh (optimizing compensation)`
    };
  }
  
  // Geef informatie over de optimalisatie
  const cheapestPrice = priceGroups[0]?.price || 0;
  const totalSlotsUsed = usedSlots.length;
  return {
    power: currentSlotPower,
    reason: `negative price: optimized charging over ${totalSlotsUsed} slots (cheapest: ${cheapestPrice.toFixed(2)} €/MWh)`
  };
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
  config: SiteEnergyConfig,
  loadState: boolean,
  forecast: SimulationDataPoint[]
): { power: number; reason: string } {
  // --- Blok 0: Trading Signal Check ---
  if (config.tradingSignalEnabled) {
    switch (current.tradingSignal) {
      case "standby":
        return { power: 0, reason: 'trading signal: standby - battery idle' };
      case "overrule":
        const requestedPower = current.tradingSignalRequestedPower;
        if (requestedPower < 0) {
          // Discharging requested
          const dischargePower = Math.abs(requestedPower);
          const maxDischargePower = Math.min(dischargePower, config.maxDischargeRate);
          if (current.soc <= config.minSoc) {
            return { power: 0, reason: 'trading signal: overrule - cannot discharge, battery empty' };
          }
          return { 
            power: maxDischargePower, 
            reason: `trading signal: overrule - discharging ${maxDischargePower.toFixed(2)} kW (requested: ${dischargePower.toFixed(2)} kW)` 
          };
        } else if (requestedPower > 0) {
          // Charging requested - handled in shouldChargeNow
          return { power: 0, reason: 'trading signal: overrule - charging requested (handled in charge logic)' };
        } else {
          // No power requested
          return { power: 0, reason: 'trading signal: overrule - no power requested' };
        }
      case "local":
        // Continue with normal optimization logic
        break;
    }
  }

  // 0. Beschikbaarheid batterij-energie controleren
  if (current.soc <= config.minSoc) {
    return { power: 0, reason: 'battery empty' };
  }

  // 1. Niet ontladen als de prijs negatief is
  if (current.consumptionPrice < 0) {
    return { power: 0, reason: 'discharging not allowed at negative price' };
  }

  // 2. Kijk vooruit naar negatieve consumptieprijs, met dynamische horizon gebaseerd op ontlaadtijd ---
  // Bepaal lookahead horizon voor negatieve prijzen
  const lookaheadSlots = getNegativePriceLookaheadHorizon(current, config, forecast);

  // Zoek het eerste slot met negatieve consumptieprijs binnen deze horizon
  let negSlot = -1;
  for (let i = 1; i <= lookaheadSlots; i++) {
    if (forecast[i].consumptionPrice < 0) {
      negSlot = i;
      break;
    }
  }

  // EN de injectieprijs is nu positief
  if (negSlot > 0 && current.injectionPrice > 0) {
    // Bepaal hoeveel energie er uit de batterij kan tot minSoc
    const socEnergy1 = (current.soc / 100) * config.batteryCapacity;
    const minEnergy1 = (config.minSoc / 100) * config.batteryCapacity;
    const allowedEnergy1 = socEnergy1 - minEnergy1;

    // Bepaal maximaal toelaatbare ontlaadvermogen (beperk door batterij en grid export limiet)
    const maxDischargePower = Math.min(config.maxDischargeRate, config.gridCapacityExportLimit);

    // Ontlaad alles wat kan in dit slot
    const maxDischarge = Math.min(maxDischargePower, allowedEnergy1 / 0.25);
    if (maxDischarge > 0) {
      return {
        power: maxDischarge,
        reason: `discharge fully before negative consumption price (slot +${negSlot}), injection price now positive`
      };
    } else {
      return {
        power: 0,
        reason: `no energy available to discharge before negative consumption price (slot +${negSlot})`
      };
    }
  }

  // --- Blok 3: Bereken het huidige tekort (consumptie - PV) en bepaal hoeveel energie je nu kunt dischargen om te consumptie te compenseren, 
  //          waarbij je voldoende reserveert voor verwachte dure uren in de nabije toekomst ---
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
  const socEnergy2 = (current.soc / 100) * config.batteryCapacity;
  const minEnergy2 = (config.minSoc / 100) * config.batteryCapacity;
  const allowedEnergy2 = socEnergy2 - minEnergy2 - futureNeed;

  // Bepaal maximaal toelaatbaar ontlaadvermogen
  const maxPower = Math.min(deficit, config.maxDischargeRate, allowedEnergy2 / 0.25);

  if (maxPower <= 0) {
    return { power: 0, reason: 'reserve for future expensive consumption' };
  }

  // Ontlaad alleen wat nodig is, tot het maximum
  return { 
    power: maxPower, 
    reason: `cover consumption (deficit: ${deficit.toFixed(2)} kW, allowed: ${allowedEnergy2.toFixed(2)} kWh, futureNeed: ${futureNeed.toFixed(2)} kWh)`
  };
}

/**
 * Berekent hoeveel vermogen er in het huidige slot moet worden geladen,
 * rekening houdend met spreiding over meerdere kwartieren om pieken te vermijden.
 * 
 * @param totalEnergyNeeded - Totale energie die moet worden geladen (kWh)
 * @param current - Huidige simulatiepunt
 * @param forecast - Array van toekomstige simulatiepunten
 * @param config - Batterijconfiguratie
 * @returns Vermogen dat in dit slot moet worden geladen (kW)
 */
function calculateSpreadChargePower(
  totalEnergyNeeded: number,
  current: SimulationDataPoint,
  forecast: SimulationDataPoint[],
  config: SiteEnergyConfig
): number {
  // Zoek naar slots met dezelfde prijs als het huidige slot
  const currentPrice = current.consumptionPrice;
  const samePriceSlots: number[] = [];
  
  // Kijk maximaal 8 uur vooruit (32 kwartieren)
  const maxLookahead = Math.min(32, forecast.length - 1);
  
  for (let i = 1; i <= maxLookahead; i++) {
    if (Math.abs(forecast[i].consumptionPrice - currentPrice) < 5) { // Kleine tolerantie voor floating point vergelijking
      samePriceSlots.push(i);
    } else {
      // Stop bij de eerste slot met een andere prijs
      break;
    }
  }
  
  // Als er geen slots met dezelfde prijs zijn, laad alles in het huidige slot
  if (samePriceSlots.length === 0) {
    return Math.min(totalEnergyNeeded / 0.25, config.maxChargeRate);
  }
  
  // Bereken beschikbare capaciteit voor elk slot (inclusief huidige slot)
  const availableCapacities: { slotIndex: number; capacity: number }[] = [];
  
  // Huidige slot
  const currentNetConsumption = current.consumption - current.pvGeneration;
  const currentAvailableCapacity = Math.max(0, config.gridCapacityImportLimit - currentNetConsumption);
  availableCapacities.push({ slotIndex: 0, capacity: currentAvailableCapacity });
  
  // Toekomstige slots
  for (const slotIndex of samePriceSlots) {
    const slot = forecast[slotIndex];
    const netConsumption = slot.consumption - slot.pvForecast;
    const availableCapacity = Math.max(0, config.gridCapacityImportLimit - netConsumption);
    availableCapacities.push({ slotIndex, capacity: availableCapacity });
  }
  
  // Bereken totale beschikbare capaciteit over alle slots
  const totalAvailableCapacity = availableCapacities.reduce((sum, slot) => sum + slot.capacity, 0);
  
  // Als er onvoldoende capaciteit is, laad alles in het huidige slot
  if (totalAvailableCapacity <= 0) {
    return Math.min(totalEnergyNeeded / 0.25, config.maxChargeRate);
  }
  
  // Verdeel de energie proportioneel over de beschikbare capaciteit
  let remainingEnergy = totalEnergyNeeded;
  let currentSlotPower = 0;
  
  for (const slot of availableCapacities) {
    if (remainingEnergy <= 0) break;
    
    // Bereken proportionele energie voor dit slot
    const proportionalEnergy = (slot.capacity / totalAvailableCapacity) * totalEnergyNeeded;
    const slotEnergy = Math.min(proportionalEnergy, remainingEnergy, slot.capacity * 0.25);
    
    // Converteer naar vermogen
    const slotPower = slotEnergy / 0.25;
    
    // Beperk tot beschikbare capaciteit en maxChargeRate
    const limitedSlotPower = Math.min(slotPower, slot.capacity, config.maxChargeRate);
    
    // Als dit het huidige slot is, sla het vermogen op
    if (slot.slotIndex === 0) {
      currentSlotPower = limitedSlotPower;
    }
    
    remainingEnergy -= limitedSlotPower * 0.25;
  }
  
  return currentSlotPower;
}

/**
 * Bepaalt de lookahead horizon voor het zoeken naar negatieve consumptieprijzen.
 * De horizon is gebaseerd op hoe lang het duurt om de batterij te ontladen.
 * 
 * @param current - Huidige simulatiepunt
 * @param config - Batterijconfiguratie
 * @param forecast - Array van toekomstige simulatiepunten
 * @returns Aantal slots om vooruit te kijken
 */
function getNegativePriceLookaheadHorizon(
  current: SimulationDataPoint,
  config: SiteEnergyConfig,
  forecast: SimulationDataPoint[]
): number {
  // Bepaal hoeveel energie er uit de batterij kan tot minSoc
  const socEnergy = (current.soc / 100) * config.batteryCapacity;
  const minEnergy = (config.minSoc / 100) * config.batteryCapacity;
  const allowedEnergy = socEnergy - minEnergy;

  // Bepaal maximaal toelaatbaar ontlaadvermogen (beperk door batterij en grid export limiet)
  const maxDischargePower = Math.min(config.maxDischargeRate, config.gridCapacityExportLimit);

  // Hoeveel kwartieren zijn er nodig om allowedEnergy te ontladen met maxDischargePower?
  // (energy per slot = power * 0.25)
  const slotsToEmpty = maxDischargePower > 0 ? Math.ceil(allowedEnergy / (maxDischargePower * 0.25)) : 0;

  // Kijk vooruit over dat aantal slots (maar niet verder dan de forecast beschikbaar is)
  return Math.min(slotsToEmpty, forecast.length - 1);
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
  batteryPower: number,
  config: SiteEnergyConfig,
  current: SimulationDataPoint,
  forecast: SimulationDataPoint[]
): { state: boolean; reason: string } {
  // Was de load in de vorige stap actief?
  const prevLoad = getPreviousLoadState(currentSlot);

  // Hoe lang is de load al aaneengesloten actief?
  const activationRuntime = getActivationRuntime(currentSlot);

  // Hoeveel uur is de load vandaag al actief geweest?
  const runtimeTillNow = getTodayRuntime(currentSlot, current.time);

  // Huidige tijd en deadline berekenen
  const currentHour = current.time.getHours();
  const currentMinute = current.time.getMinutes();
  const slotsPerHour = 4;
  const deadlineHour = config.loadRuntimeDeadlineHour;

  // Bepaal de dag van vandaag (zodat we alleen naar vandaag kijken)
  const today = new Date(current.time);
  today.setHours(0, 0, 0, 0);

  // Voor de load state bepaling gebruiken we de forecast data
  // We kunnen niet meer terugkijken naar eerdere slots van vandaag omdat we geen data array hebben
  // Dit is een beperking van de nieuwe aanpak, maar we kunnen wel de runtime bijhouden via storage
  
  // Kijk vooruit vanaf currentSlot tot aan de deadline
  const futureSlots: { index: number; point: SimulationDataPoint }[] = [];
  
  // Voeg huidige slot toe
  if (currentHour < deadlineHour || (currentHour === deadlineHour && currentMinute === 0)) {
    futureSlots.push({ index: currentSlot, point: current });
  }
  
  // Voeg forecast slots toe
  for (let i = 1; i < forecast.length; i++) {
    const slot = forecast[i];
    const slotTime = slot.time;
    const slotHour = slotTime.getHours();
    const slotMinute = slotTime.getMinutes();
    
    // Alleen slots van vandaag
    const slotDay = new Date(slotTime);
    slotDay.setHours(0, 0, 0, 0);
    if (slotDay.getTime() !== today.getTime()) continue;
    
    // Alleen slots tot aan de deadline
    if (slotHour < deadlineHour || (slotHour === deadlineHour && slotMinute === 0)) {
      futureSlots.push({ index: currentSlot + i, point: slot });
    }
  }

  // 1. Tel het aantal slots met PV-overschot >= activation power (alleen betaalbare PV)
  const pvOversupplySlots: number[] = [];
  for (const { index, point } of futureSlots) {
    // Converteer consumptieprijs van €/kWh naar €/MWh voor vergelijking
    const consumptionPricePerMWh = point.consumptionPrice;
    
    // Gebruik alleen PV generatie van omvormers met prijs lager dan huidige consumptieprijs
    const affordablePvGeneration = getAffordablePvGeneration(point, config, consumptionPricePerMWh);
    
    // Bepaal oversupply na batterij (gebruik 0 voor batteryPower in toekomst)
    const oversupply = affordablePvGeneration - point.consumption - Math.max(0, 0);
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
  const candidateSlots = futureSlots.map(({ index, point }) => {
    // Converteer consumptieprijs van €/kWh naar €/MWh voor vergelijking
    const consumptionPricePerMWh = point.consumptionPrice;
    
    // Gebruik alleen PV generatie van omvormers met prijs lager dan huidige consumptieprijs
    const affordablePvGeneration = getAffordablePvGeneration(point, config, consumptionPricePerMWh);
    
    return {
      index,
      price: point.consumptionPrice,
      pvOversupply: (affordablePvGeneration - point.consumption) >= config.loadActivationPower,
    };
  });

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
    return { setpoint: nonControllableCapacity, reason: 'negative consumption price - PV setpoint limited to non-controllable capacity' };
  }

  if (current.injectionPrice < 0) {
    let effectiveConsumption = current.consumption + decision.batteryPower;
    if (decision.loadState) {
      effectiveConsumption += config.loadNominalPower; //TODO: hier marge aan toevoegen omdat we niet exact weten hoeveel de load gaat verbruiken
    }
    const excess = Math.max(0, currentPvGeneration - effectiveConsumption);
    
    // Setpoint is non-controllable capacity plus any controllable capacity needed to avoid excess
    const controllableNeeded = Math.min(excess, controllableCapacity);
    const setpoint = nonControllableCapacity + controllableNeeded;
    return { setpoint, reason: 'negative injection price - PV setpoint limited to avoid excess' };
  }

  return { setpoint: nonControllableCapacity + controllableCapacity, reason: 'no setpoint limitation needed' };
} 