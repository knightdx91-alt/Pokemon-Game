# DraStic APKs (RE subject)

Both r2.6.0.4a builds, one per ABI:

| File | ABI | Native cores | 32-bit device? |
|---|---|---|---|
| `DraStic_r2.6.0.4a_arm64-v8a.apk` (10.9 MB) | `arm64-v8a` | `libdrastic_arm64.so`, `libdrastic_cpu.so` | ❌ no |
| `DraStic_r2.6.0.4a_armeabi-v7a.apk` (12.6 MB) | `armeabi-v7a` | `libdrastic.so`, `libdrastic_compat.so`, `libdrastic_cpu.so` | ✅ yes |

Extract with `unzip`; the emulator core is `lib/<abi>/libdrastic*.so`. Run the
recon with `python3 ../analysis/analyze_drastic.py lib/<abi>/libdrastic*.so`.

The **armeabi-v7a** core (`libdrastic.so`) is the primary RE target — Thumb-2 is
more tractable than the stripped AArch64, and it's the more broadly compatible
build. `libdrastic_compat.so` is the non-JIT/compat fallback core.
