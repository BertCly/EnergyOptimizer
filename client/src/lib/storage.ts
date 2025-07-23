/**
 * Storage utility for tracking load states across time slots
 * Uses localStorage to persist load state history
 */

const LOAD_STATE_STORAGE_KEY = 'energy_optimizer_load_states';

export interface LoadStateRecord {
  slotIndex: number;
  timestamp: number;
  loadState: boolean;
}

/**
 * Get all stored load states
 */
export function getLoadStates(): LoadStateRecord[] {
  try {
    const stored = localStorage.getItem(LOAD_STATE_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.warn('Failed to load load states from storage:', error);
    return [];
  }
}

/**
 * Store a load state for a specific slot
 */
export function storeLoadState(slotIndex: number, loadState: boolean): void {
  try {
    const states = getLoadStates();
    
    // Find existing record for this slot
    const existingIndex = states.findIndex(state => state.slotIndex === slotIndex);
    
    const record: LoadStateRecord = {
      slotIndex,
      timestamp: Date.now(),
      loadState
    };
    
    if (existingIndex >= 0) {
      // Update existing record
      states[existingIndex] = record;
    } else {
      // Add new record
      states.push(record);
    }
    
    // Sort by slot index
    states.sort((a, b) => a.slotIndex - b.slotIndex);
    
    localStorage.setItem(LOAD_STATE_STORAGE_KEY, JSON.stringify(states));
  } catch (error) {
    console.warn('Failed to store load state:', error);
  }
}

/**
 * Get load state for a specific slot
 */
export function getLoadState(slotIndex: number): boolean | null {
  const states = getLoadStates();
  const record = states.find(state => state.slotIndex === slotIndex);
  return record ? record.loadState : null;
}

/**
 * Get load states for a range of slots
 */
export function getLoadStatesForRange(startSlot: number, endSlot: number): boolean[] {
  const states = getLoadStates();
  const result: boolean[] = [];
  
  for (let i = startSlot; i < endSlot; i++) {
    const record = states.find(state => state.slotIndex === i);
    result.push(record ? record.loadState : false);
  }
  
  return result;
}

/**
 * Get the previous load state (for the slot before currentSlot)
 */
export function getPreviousLoadState(currentSlot: number): boolean {
  if (currentSlot <= 0) return false;
  
  const states = getLoadStates();
  const record = states.find(state => state.slotIndex === currentSlot - 1);
  return record ? record.loadState : false;
}

/**
 * Get the activation runtime (how long the load has been continuously active)
 */
export function getActivationRuntime(currentSlot: number): number {
  const states = getLoadStates();
  let runtime = 0;
  
  // Count backwards from currentSlot - 1 until we find a slot where load was off
  for (let i = currentSlot - 1; i >= 0; i--) {
    const record = states.find(state => state.slotIndex === i);
    if (record && record.loadState) {
      runtime += 0.25; // 15 minutes = 0.25 hours
    } else {
      break;
    }
  }
  
  return runtime;
}

/**
 * Get the total runtime for today (up to currentSlot)
 */
export function getTodayRuntime(currentSlot: number, currentTime: Date): number {
  const states = getLoadStates();
  let runtime = 0;
  
  // Get today's date (start of day)
  const today = new Date(currentTime);
  today.setHours(0, 0, 0, 0);
  
  // Count all load states from today up to currentSlot
  for (let i = 0; i < currentSlot; i++) {
    const record = states.find(state => state.slotIndex === i);
    if (record && record.loadState) {
      runtime += 0.25; // 15 minutes = 0.25 hours
    }
  }
  
  return runtime;
}

/**
 * Clear all stored load states
 */
export function clearLoadStates(): void {
  try {
    localStorage.removeItem(LOAD_STATE_STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear load states:', error);
  }
}

/**
 * Initialize storage for a new simulation
 * Clears old data and prepares for new simulation
 */
export function initializeSimulation(): void {
  clearLoadStates();
  console.log('Storage initialized for new simulation');
} 