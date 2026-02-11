import { SignalSchema, Signal, SignalCollection, type SignalType } from "./types.js";

/**
 * Parse signals from a JSON file or object
 */
export function parseSignals(data: unknown): SignalCollection {
  // Handle array of signals
  if (Array.isArray(data)) {
    const signals = data.map((item, index) => parseSignal(item, index));
    return { signals };
  }

  // Handle object with signals array
  if (typeof data === "object" && data !== null) {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.signals)) {
      const signals = obj.signals.map((item, index) => parseSignal(item, index));
      return { signals };
    }
  }

  // Single signal
  return { signals: [parseSignal(data, 0)] };
}

/**
 * Parse a single signal
 */
function parseSignal(data: unknown, fallbackIndex: number): Signal {
  // Handle missing ID by adding it before parsing
  let signalData = data;
  if (typeof data === "object" && data !== null) {
    const obj = data as Record<string, unknown>;
    if (!obj.id) {
      signalData = {
        ...obj,
        id: `signal-${fallbackIndex}-${Date.now()}`,
      };
    }
  }

  const result = SignalSchema.safeParse(signalData);

  if (!result.success) {
    throw new Error(
      `Invalid signal format: ${result.error.issues.map((i) => i.message).join(", ")}`
    );
  }

  return result.data;
}

/**
 * Normalize signals - ensure all signals are in a consistent format
 */
export function normalizeSignals(signals: Signal[]): Signal[] {
  return signals.map((signal, index) => ({
    ...signal,
    id: signal.id || `signal-${index}-${Date.now()}`,
    metadata: signal.metadata || {},
  }));
}

/**
 * Filter signals by type
 */
export function filterSignalsByType(signals: Signal[], type: SignalType): Signal[] {
  return signals.filter((s) => s.type === type);
}

/**
 * Find signal by name
 */
export function findSignalByName(signals: Signal[], name: string): Signal | undefined {
  return signals.find((s) => s.name === name);
}

/**
 * Find signals by type and name pattern
 */
export function findSignals(
  signals: Signal[],
  type?: SignalType,
  namePattern?: string
): Signal[] {
  let filtered = signals;

  if (type) {
    filtered = filtered.filter((s) => s.type === type);
  }

  if (namePattern) {
    const pattern = new RegExp(namePattern);
    filtered = filtered.filter((s) => pattern.test(s.name));
  }

  return filtered;
}
