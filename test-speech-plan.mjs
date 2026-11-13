import assert from "node:assert/strict";
import { MODEL_SPEC } from "./tts/model-spec.js";
import {
  clampSpeed, pcmStats, recordIsValid, silentInitAllowed, splitSpeakChunks, voiceForText
} from "./tts/speech-plan.js";

const spec = {
  ...MODEL_SPEC,
  sha256: "abc",
  bytes: 10,
  version: "v-test"
};
const blob = { size: 10 };
const good = { version: "v-test", bytes: 10, sha256: "abc", blob };

assert.equal(voiceForText("My name is Jack.", "en-US"), "af_maple");
assert.equal(voiceForText("第 1 章冒险开始", "zh-CN"), "zf_001");
assert.equal(voiceForText("Look at the bus. 看牌子", "en-US"), "zf_001");
assert.equal(voiceForText("42", ""), "zf_001");
assert.equal(clampSpeed(0.92), 0.92);
assert.equal(clampSpeed(9), 2);

const chunks = splitSpeakChunks("My name is Jack. I live in a tree house. It has a sword.");
assert.ok(chunks.length >= 2);
assert.match(chunks[0], /^My name is Jack/);
assert.equal(splitSpeakChunks("Mr. Sullivan stays.").length, 1);

assert.equal(recordIsValid(good, spec), true);
assert.equal(recordIsValid({ ...good, bytes: 9 }, spec), false);
assert.equal(recordIsValid({ ...good, blob: { size: 9 } }, spec), false);
assert.equal(silentInitAllowed("v-test", null, spec), false);
assert.equal(silentInitAllowed("v-test", { ...good, sha256: "nope" }, spec), false);
assert.equal(silentInitAllowed("", good, spec), true);

const silent = new Float32Array(200);
assert.equal(pcmStats(silent).audible, false);
const tone = new Float32Array(200);
for (let i = 0; i < tone.length; i++) tone[i] = Math.sin(i / 3) * 0.2;
assert.equal(pcmStats(tone).audible, true);
assert.equal(MODEL_SPEC.bytes, 339369442);
assert.equal(MODEL_SPEC.voices.en, "af_maple");
assert.equal(MODEL_SPEC.voices.zh, "zf_001");
assert.match(MODEL_SPEC.sha256, /^[0-9a-f]{64}$/);
console.log("speech plan tests passed");
