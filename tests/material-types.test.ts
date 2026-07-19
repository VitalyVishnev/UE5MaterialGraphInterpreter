import { describe, expect, it } from "vitest";

import {
  castNumericFamily,
  isNumericType,
  materialTypeOptions,
  numericDimensions,
  numericFamily,
  numericType,
  promoteNumericTypes,
} from "../src/graph/material-types";

describe("numeric material type algebra", () => {
  it("owns numeric construction, promotion, dimensions, and family casts", () => {
    expect(numericType(3)).toBe("float3");
    expect(numericType(5)).toBeUndefined();
    expect(numericDimensions("uint4")).toBe(4);
    expect(numericFamily("uint4")).toBe("uint");
    expect(promoteNumericTypes("float", "float3")).toBe("float3");
    expect(promoteNumericTypes("float2", "float3")).toBeUndefined();
    expect(promoteNumericTypes("float", "uint")).toBeUndefined();
    expect(castNumericFamily("float3", "uint")).toBe("uint3");
  });

  it("keeps uint internal rather than exposing it as a manual function override", () => {
    expect(materialTypeOptions.some((type) => type.startsWith("uint"))).toBe(false);
    expect(isNumericType("uint4")).toBe(true);
  });
});
