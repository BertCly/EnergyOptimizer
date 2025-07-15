import { SimulationDataPoint } from "@shared/schema";

export function generateSimulationData(initialSoc: number): SimulationDataPoint[] {
  const data: SimulationDataPoint[] = [];
  const startTime = new Date();
  startTime.setHours(8, 0, 0, 0); // Start at 8:00 AM

  for (let i = 0; i < 48; i++) {
    const time = new Date(startTime.getTime() + i * 15 * 60 * 1000);
    const hour = time.getHours();

    // Price pattern with peak between 17-21h
    let price = 0.15; // Base price
    if (hour >= 17 && hour <= 21) {
      price = 0.45 + Math.random() * 0.15; // Peak price
    } else if (hour >= 6 && hour <= 10) {
      price = 0.25 + Math.random() * 0.05; // Morning medium price
    } else if (hour >= 22 || hour <= 6) {
      price = 0.10 + Math.random() * 0.05; // Night low price
    } else {
      price = 0.20 + Math.random() * 0.10; // Day normal price
    }

    // Consumption pattern with afternoon peak
    let consumption = 15; // Base consumption
    if (hour >= 16 && hour <= 20) {
      consumption = 35 + Math.random() * 10; // Afternoon/evening peak
    } else if (hour >= 7 && hour <= 9) {
      consumption = 25 + Math.random() * 5; // Morning medium
    } else if (hour >= 22 || hour <= 6) {
      consumption = 10 + Math.random() * 5; // Night low
    } else {
      consumption = 20 + Math.random() * 10; // Day normal
    }

    // PV generation pattern (10:00-16:00)
    let pvGeneration = 0;
    if (hour >= 10 && hour <= 16) {
      const midDay = 13; // Peak at 13:00
      const distanceFromPeak = Math.abs(hour - midDay);
      const maxGeneration = 40;
      pvGeneration = Math.max(0, maxGeneration * (1 - distanceFromPeak / 3) + Math.random() * 5);
    }

    data.push({
      time,
      timeString: time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      price,
      consumption,
      pvGeneration,
      batteryPower: 0,
      soc: initialSoc,
      netPower: 0,
      cost: 0,
    });
  }

  return data;
}
