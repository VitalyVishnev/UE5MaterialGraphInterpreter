import { describe, expect, it } from "vitest";

import { constrainLayout } from "../src/resizable-layout";

describe("constrainLayout", () => {
  it("keeps both side panes visible when either side is dragged to its maximum", () => {
    expect(constrainLayout(1200, 800, { left: 230, right: 2000, input: 200 }))
      .toMatchObject({ left: 230, right: 596 });
    expect(constrainLayout(1200, 800, { left: 2000, right: 220, input: 200 }))
      .toMatchObject({ left: 656, right: 170 });
  });
});
