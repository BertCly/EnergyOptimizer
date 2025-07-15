import { BatteryConfig, SimulationDataPoint } from "@shared/schema";

// Storage interface for battery simulation data
export interface IStorage {
  saveSimulationData(data: SimulationDataPoint[]): Promise<void>;
  getBatteryConfig(): Promise<BatteryConfig | undefined>;
  saveBatteryConfig(config: BatteryConfig): Promise<void>;
}

export class MemStorage implements IStorage {
  private simulationData: SimulationDataPoint[] = [];
  private batteryConfig: BatteryConfig | undefined;

  constructor() {}

  async saveSimulationData(data: SimulationDataPoint[]): Promise<void> {
    this.simulationData = data;
  }

  async getBatteryConfig(): Promise<BatteryConfig | undefined> {
    return this.batteryConfig;
  }

  async saveBatteryConfig(config: BatteryConfig): Promise<void> {
    this.batteryConfig = config;
  }
}

export const storage = new MemStorage();
