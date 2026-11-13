/* Kokoro-82M-v1.1-zh-ONNX fp32, the same revision Zhidao pins.
 * English Phonon is the Kokoro voice id af_maple. Chinese is zf_001.
 * sha256 is filled from the downloaded model bytes; do not guess it. */
export const MODEL_SPEC = {
  id: "onnx-community/Kokoro-82M-v1.1-zh-ONNX",
  revision: "6cc0f0d2ebe369a68b0df87c2b65c1af8c0ac3e3",
  dtype: "fp32",
  version: "kokoro-82m-v1.1-zh-onnx-fp32@6cc0f0d2ebe369a68b0df87c2b65c1af8c0ac3e3",
  bytes: 339369442,
  sha256: "94b973941b1852754f979be5d5e20be666d5c81d9bb886b88ae1dc85c9b895ca",
  path: "/tts/models/onnx-community/Kokoro-82M-v1.1-zh-ONNX/onnx/model.onnx",
  voices: { en: "af_maple", zh: "zf_001" },
  runtimeCache: "kidsreading-phonon-runtime-v3",
  idbName: "kidsreading-phonon",
  idbStore: "files",
  markerKey: "kidsreading-phonon-cache-marker",
  firstDownloadLabel: "约 324 MB"
};
