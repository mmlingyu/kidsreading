Offline speech in this site is adapted from the worker, queue, and Kokoro engine bundle used by zhidao-web. The page does not vendor that app.

`kokoro-tts.js` is the existing zhidao browser bundle (Kokoro, transformers.js, ONNX Runtime Web). The bundle's own trailer states ONNX Runtime Web is MIT, Copyright Microsoft. This copy sets `allowRemoteModels` to false so a missing file fails on this origin instead of fetching another host.

The model file itself is not stored here. Its id, revision, size, and sha256 are in `model-spec.js`. Voice ids in use are the Kokoro ids `af_maple` (English, called Phonon in the Zhidao mapping) and `zf_001` (Chinese).
