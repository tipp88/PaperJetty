# Adobe Scan investigation — dev branch

## Status

Analyzed the user-supplied Adobe Scan 26.10.06 (263183520) APK bundle with
REA/JADX and inspected its ARM64 libraries. This is static analysis; Adobe Scan
was not executed on an Android device. The full proprietary scanner has **not**
been ported. DocuScan implements an independent browser capture workflow inspired
by the observed states and documented interaction.

The `dev` branch adds an explicit auto/manual switch, actionable search/hold/ready
hints, a manual fallback hint after eight seconds, and capability-checked
continuous focus, exposure and white balance. Camera failures now show real
errors instead of a simulated camera. Pending permission requests are safely
invalidated when leaving the camera.

The existing burst selection remains: native video resolution, corners belonging
to the selected snapshot, relative sharpness ranking without an absolute
sharpness rejection threshold. These are DocuScan decisions, **not recovered
Adobe algorithms**. Eight seconds is likewise a DocuScan UI choice.

## Local toolchain

- Official repository: <https://github.com/morluto/rea>.
- Repository documentation inspected at commit
  `d72d856f58d4747c5eb4307426e80d20934e017c`.
- Installed release: `rea-agents@6.5.0`, the npm distribution linked by that
  repository. npm integrity:
  `sha512-C6BG7LyrAdR74mSjertM6PrxJkcNZ2bfQNOJornPo9erDEp2tyPRVYPnV5Yodr+1RqewCQla68WulXlVnveD+A==`.
- Android engine: `jadx-headless-mcp-0.7.1-all.jar`, verified against REA's pinned
  SHA-256 `6e5eacf500b64292bfb73c49797c1958f6ee44646e43e868039ae7feb573ff75`.
- Portable JDK: Eclipse Temurin `jdk-21.0.12.1+1`, Linux x64. The archive was
  verified against Adoptium's release metadata:
  `ce79869e1307ed8ee1e2baa86a412b1eb5b75d10a01006d788a6f968bcfaee94`.

Tools are under `.local-tools/`; private targets and raw evidence belong under
`.analysis/`. Both are excluded from Git and are not application dependencies.
No global MCP configuration has been changed. The CLI uses the same analysis
workflows without requiring an agent restart.

Run from the repository root:

```sh
node scripts/rea.mjs --version
node scripts/rea.mjs inspect-android-package /absolute/path/to/adobe-scan.apk --format json
node scripts/rea.mjs search-android-classes /absolute/path/to/adobe-scan.apk Camera --format json
```

The launcher uses the installed local JDK and JADX paths unless `JAVA_HOME` or
`REA_JADX_MCP_JAR` explicitly selects a different installation. On a fresh
checkout install the pinned CLI first:

```sh
npm install --prefix .local-tools/rea --save-exact --ignore-scripts --no-audit --no-fund rea-agents@6.5.0
```

Install the separately required JDK and JADX following the
[official Android guide](https://github.com/morluto/rea/blob/d72d856f58d4747c5eb4307426e80d20934e017c/docs/android-analysis.md).
The launcher's local JDK location is
`.local-tools/android/jdk/jdk-21.0.12.1+1`; the JADX JAR belongs directly under
`.local-tools/android/`.

## Publicly documented behavior

Adobe documents automatic capture as the default, a manual-capture alternative,
live corner indicators, and prompts for document search, holding still, and
manual capture when boundaries cannot be found. Captured scans can be cropped,
have their corners adjusted, and be retaken. These are product behaviors, not
evidence of a particular camera API or image-processing algorithm.

Sources:

- [Adobe Scan Android: scan a document](https://www.adobe.com/devnet-docs/adobescan/android/en/scan.html#scan-a-document)
- [Adobe Scan Android: settings](https://www.adobe.com/devnet-docs/adobescan/android/en/settings.html)

## Target and evidence

The supplied `.apkm` contains 20 APKs, including base, ARM64, language and density
splits. No APK, decompiled source, native library, asset or model was incorporated
into application code or committed.

| Artifact | SHA-256 |
| --- | --- |
| Supplied bundle | `9a59386c2c7c1a77d9e25654948f4b52e5074bcd07aea5444eb2ef17b2cce830` |
| base.apk | `71c9d14a7541241f125b4fe409589e15fc48b387c197e7cf8588d6c291b17513` |
| ARM64 split | `63032e4337b10c08a5079bd1ed88a4c78e69ecc657bec4696ac4db93082a2254` |
| libMagicClean.so | `d322e6d3d1a76919dc7288227ab01ad2678bddd5cde73c4d310add374fc7b351` |

Local evidence is stored under `.analysis/adobe-scan/`. Evidence IDs identify
REA outputs, not publicly hosted reports.

| Observation | Evidence file and REA ID |
| --- | --- |
| Package/version, minimum SDK 30, target SDK 36; capture/review activities | `package.json`, `ev_464a9d43d5208d11566a8f8ea20e29441de7d4b95718e10b38f92b83ac06c322` |
| CaptureActivity inventory includes live boundary hints and capture mode methods | `capture-activity.json`, `ev_116145dc3bcd1fdca8a107241dfe538639edbbe6fcda5190e19b94329d764707` |
| B2 consumes a LiveBoundaryHint, consults state and updates capture guidance | `capture-hints-method.json`, `ev_1f038bacc0fde094e66198890773940023a1f92e78e833f4f0c409f5a1c0b824` |
| q1 reads a Boolean state; its meaning is not established merely by its name | `capture-q1-method.json`, `ev_2348eb745930a7cff47aaebca301959a6da22a13bfefec9295ca960fb8ff3bbe` |
| LiveBoundaryHint enum includes LookingForDocument, HoldForCapture, ReadyForCapture, None | `boundary-hints-dot.json`, `ev_23b367f7ca5a5caf2106239b2cb5f61a218477719a5bb8d0e7e8071e3bf98336` |

The synthetic enum switch in `CaptureActivity.r0.<clinit>` maps HoldForCapture
and ReadyForCapture to the two branches consumed by B2. REA provided Smali for
this initializer (`hint-mapping.json`,
`ev_e75c334a52df05bdfe9712414162968f0d666b1f4d74632e8c451a3ef0516aa5`).
This confirms hint routing, not the native decision criteria or shutter timing.

### Native scanner boundary

The ARM64 split contains 33 native libraries. `libMagicClean.so` links
`libLiteRt.so` and imports TensorFlow Lite/LiteRT interpreter functions. Its strings
reference live edge/document detection shims, CNN boundary detection and document
dewarping. The base APK contains TFLite assets named `capture_6_22_23.tflite`,
`page_turn_2im_002.tflite` and `resize_to_320.tflite`.

These are evidence of bundled native/ML capabilities, not proof of which model
runs for a particular capture or of its quality. AndroidX image processing JNI,
JPEG compression and Scan2PDF libraries are also present. Detailed inventories,
ELF dependencies and symbol observations are in `native-review/` locally.

A Vite/React browser app cannot directly invoke Android JNI libraries. The native
algorithms, model behavior, capture thresholds, autofocus timing and image fusion
remain unrecovered. No claim of Adobe-quality equivalence is made.

### Tool limitations

REA's CLI successfully inspected package/classes and selected method bodies.
Some class searches returned an unreadable provider result; the affected
observations were not treated as evidence. Inner classes must use JADX's dotted
name, not the DEX `$` separator. The optional persistent MCP connection failed;
analysis used the working CLI. JADX source includes type-inference warnings.
Signatures and runtime behavior were not verified.

## Implementation and validation

- `useCamera.ts` / `cameraSettings.ts`: request supported continuous camera modes
  without blocking startup or changing resolution constraints; rejected controls
  leave capture available. Generation checks stop late camera streams after
  unmount. This uses the [W3C Image Capture controls](https://www.w3.org/TR/image-capture/#extensions),
  not a claim about Adobe's autofocus implementation.
- `CameraCapture.tsx`: explicit auto/manual mode, one actionable status and a
  timeout hint offering the shutter. Manual mode keeps live corners but never
  starts an automatic burst. The shutter remains available without detection.
- Existing OpenCV detection, perspective correction, crop editing and image
  enhancement remain DocuScan's implementation.
- Automated regression suite: 29 passing tests, covering frame selection,
  motion, low-detail pages, slow cameras, cancellation and optional camera modes.
- Production TypeScript/Vite/PWA build passed.
- Headless Chrome with a synthetic document camera passed automatic capture,
  manual mode staying open for ten seconds and then capturing, and denied
  permission with retry. No uncaught page errors. This exercised the actual
  React UI and bundled OpenCV, but not a physical camera.

A real Pixel camera trial remains necessary to assess autofocus and hand motion;
synthetic browser frames cannot establish physical camera quality. Keep this
work on `dev` until that trial is satisfactory.
