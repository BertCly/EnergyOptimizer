import { SiteEnergyConfig, SimulationDataPoint } from "@shared/schema";

// Storage interface for battery simulation data
export interface IStorage {
  saveSimulationData(data: SimulationDataPoint[]): Promise<void>;
  getSiteEnergyConfig(): Promise<SiteEnergyConfig | undefined>;
  saveSiteEnergyConfig(config: SiteEnergyConfig): Promise<void>;
}

export class MemStorage implements IStorage {
  private simulationData: SimulationDataPoint[] = [];
  private siteEnergyConfig: SiteEnergyConfig | undefined;

  constructor() {}

  async saveSimulationData(data: SimulationDataPoint[]): Promise<void> {
    this.simulationData = data;
  }

  async getSiteEnergyConfig(): Promise<SiteEnergyConfig | undefined> {
    return this.siteEnergyConfig;
  }

  async saveSiteEnergyConfig(config: SiteEnergyConfig): Promise<void> {
    this.siteEnergyConfig = config;
  }
}

export const storage = new MemStorage();
