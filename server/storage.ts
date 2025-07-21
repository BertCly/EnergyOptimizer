import { SiteEnergyConfig, SimulationDataPoint } from "@shared/schema";

// Storage interface for battery simulation data
export interface IStorage {
  saveSimulationData(data: SimulationDataPoint[]): Promise<void>;
  getBatteryConfig(): Promise<SiteEnergyConfig | undefined>;
  saveBatteryConfig(config: SiteEnergyConfig): Promise<void>;
}

export class MemStorage implements IStorage {
  private simulationData: SimulationDataPoint[] = [];
  private batteryConfig: SiteEnergyConfig | undefined;

  constructor() {}

  async saveSimulationData(data: SimulationDataPoint[]): Promise<void> {
    this.simulationData = data;
  }

  async getBatteryConfig(): Promise<SiteEnergyConfig | undefined> {
    return this.batteryConfig;
  }

  async saveBatteryConfig(config: SiteEnergyConfig): Promise<void> {
    this.batteryConfig = config;
  }
}

export const storage = new MemStorage();
