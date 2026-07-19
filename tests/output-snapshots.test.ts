import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { analyzeClipboard } from "../src/analyze";

const sampleIt = existsSync(resolve("samples")) ? it : it.skip;

function snapshot(fixture: string): object {
  const result = analyzeClipboard(readFileSync(resolve(fixture), "utf8"));
  return {
    code: result.code,
    diagnostics: result.diagnostics.map(({ code, severity }) => ({ code, severity })),
  };
}

describe("stable user-visible analysis", () => {
  sampleIt("covers supported, partial, opaque, and broken inputs", () => {
    expect(snapshot("samples/SceneColor/SceneColor_full_clipboard.txt")).toMatchSnapshot("supported");
    expect(snapshot("samples/SceneColor/SceneColor_partial_1_clipboard.txt")).toMatchSnapshot("partial");
    expect(
      snapshot(
        "samples/Bayer_Matrix_Dither_-_Material_Function/Bayer_Matrix_Dither_-_Material_Function_full_clipboard.txt",
      ),
    ).toMatchSnapshot("opaque");
    expect(
      snapshot("samples/MF_GerstnerWaves/MF_GerstnerWaves_half_of_clipboard_deleted.txt"),
    ).toMatchSnapshot("broken");
  });
});
