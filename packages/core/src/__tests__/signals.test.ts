import { describe, it, expect } from "vitest";
import {
  parseSignals,
  normalizeSignals,
  filterSignalsByType,
  findSignalByName,
} from "../signals/parser.js";
import type { Signal } from "../signals/types.js";

describe("Signals", () => {
  describe("parseSignals", () => {
    it("parses array of signals", () => {
      const data = [
        {
          id: "sig-1",
          type: "eval",
          name: "accuracy-eval",
          value: 0.95,
        },
        {
          id: "sig-2",
          type: "risk_flag",
          name: "security-risk",
          value: { level: "high" },
        },
      ];

      const result = parseSignals(data);
      expect(result.signals).toHaveLength(2);
      expect(result.signals[0]?.type).toBe("eval");
      expect(result.signals[1]?.type).toBe("risk_flag");
    });

    it("parses object with signals array", () => {
      const data = {
        signals: [
          {
            id: "sig-1",
            type: "human_review",
            name: "approval",
            value: "approved",
          },
        ],
      };

      const result = parseSignals(data);
      expect(result.signals).toHaveLength(1);
    });

    it("generates IDs for signals without IDs", () => {
      const data = [
        {
          type: "eval",
          name: "test",
          value: 1,
        },
      ];

      const result = parseSignals(data);
      expect(result.signals[0]?.id).toBeDefined();
    });
  });

  describe("normalizeSignals", () => {
    it("ensures all signals have IDs and metadata", () => {
      const signals: Signal[] = [
        {
          id: "",
          type: "eval",
          name: "test",
          value: 1,
        },
      ];

      const normalized = normalizeSignals(signals);
      expect(normalized[0]?.id).toBeDefined();
      expect(normalized[0]?.metadata).toBeDefined();
    });
  });

  describe("filterSignalsByType", () => {
    it("filters signals by type", () => {
      const signals: Signal[] = [
        {
          id: "1",
          type: "eval",
          name: "eval1",
          value: 1,
        },
        {
          id: "2",
          type: "risk_flag",
          name: "risk1",
          value: "high",
        },
        {
          id: "3",
          type: "eval",
          name: "eval2",
          value: 2,
        },
      ];

      const filtered = filterSignalsByType(signals, "eval");
      expect(filtered).toHaveLength(2);
      expect(filtered.every((s) => s.type === "eval")).toBe(true);
    });
  });

  describe("findSignalByName", () => {
    it("finds signal by name", () => {
      const signals: Signal[] = [
        {
          id: "1",
          type: "eval",
          name: "accuracy",
          value: 0.95,
        },
        {
          id: "2",
          type: "eval",
          name: "latency",
          value: 100,
        },
      ];

      const found = findSignalByName(signals, "accuracy");
      expect(found?.name).toBe("accuracy");
      expect(found?.value).toBe(0.95);
    });

    it("returns undefined if not found", () => {
      const signals: Signal[] = [
        {
          id: "1",
          type: "eval",
          name: "accuracy",
          value: 0.95,
        },
      ];

      const found = findSignalByName(signals, "nonexistent");
      expect(found).toBeUndefined();
    });
  });
});
