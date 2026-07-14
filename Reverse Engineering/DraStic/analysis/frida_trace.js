// DraStic on-device dynamic tracer (Frida) — find the DS memory/wireless handler.
//
// WHY: DraStic is a dynarec that assembles host ARM code, so static search can't
// locate the DS memory dispatch (see FINDINGS_JIT.md — the 0x8825c "hit" was an
// opcode template, retracted). The cloud Unicorn harness can load the core but
// can't BOOT it (no Android/JNI runtime + ROM). This script runs against the
// LIVE app on a device/emulator, where a running game touches the DS I/O path
// every frame — so the handler executes constantly and can be observed.
//
// STATUS: written for on-device use; NOT executed in the cloud RE session, so
// treat addresses/offsets as starting points and verify on target. Frida config
// (SELinux, root/gadget) is the user's responsibility.
//
// USAGE:
//   frida -U -n "DraStic" -l frida_trace.js         # attach to running app
//   frida -U -f com.dsemu.drastic -l frida_trace.js --no-pause   # spawn
//   then in the REPL:  cov()  ...play a moment...  covStop()   // coverage narrow
//                      probe(ptr('0x...'))                      // test a candidate
//
// The DS ARM7 wireless region is 0x04800000-0x0480ffff (guest space). The goal
// is the HOST function that services a guest access to it.

'use strict';

// Pick the right core for the device's ABI.
const LIBS = ['libdrastic.so', 'libdrastic_arm64.so', 'libdrastic_compat.so'];
let mod = null;
for (const n of LIBS) { const m = Process.findModuleByName(n); if (m) { mod = m; break; } }
if (!mod) { console.log('[!] libdrastic not loaded yet; call again after a ROM is inserted'); }
else console.log(`[+] ${mod.name} base=${mod.base} size=0x${mod.size.toString(16)}`);

// --- Lifecycle anchors: the JNI surface tells us when a game is running -------
function hookJNI() {
  ['insertGame', 'renderFrame', 'pauseSystem'].forEach(sym => {
    const full = 'Java_com_dsemu_drastic_DraSticJNI_' + sym;
    const p = mod && mod.findExportByName(full);
    if (p) {
      Interceptor.attach(p, { onEnter() { /* mark liveness */ this._t = Date.now(); } });
      console.log(`[+] hooked ${sym} @ ${p}`);
    }
  });
}

// --- Strategy 1: Stalker coverage narrowing -----------------------------------
// Follow the emulation thread for a short window while a game runs; collect the
// set of executed basic blocks. Run twice: once with wireless idle, once while a
// game performs a wireless action (e.g. entering a multiplayer menu / Download
// Play). The blocks that appear ONLY in the second set are wireless-path
// candidates. Diff externally (dump both to files).
let covSet = null;
function cov() {
  covSet = new Set();
  const tid = Process.enumerateThreads()[0].id; // adjust: pick the emu thread
  Stalker.follow(tid, {
    events: { compile: true },
    onReceive() {},
    transform(iterator) {
      let ins = iterator.next();
      const base = mod.base, end = mod.base.add(mod.size);
      do {
        if (ins.address.compare(base) >= 0 && ins.address.compare(end) < 0)
          covSet.add(ins.address.sub(base).toString(16)); // module-relative
        iterator.keep();
      } while ((ins = iterator.next()) !== null);
    }
  });
  console.log(`[+] Stalker following thread ${tid}. Reproduce the action, then covStop().`);
}
function covStop() {
  Stalker.unfollow();
  Stalker.flush();
  const arr = [...covSet].sort();
  console.log(`[+] coverage: ${arr.length} unique module-relative blocks`);
  // dump to a file the host can pull
  const path = '/data/data/com.dsemu.drastic/cache/cov_' + Date.now() + '.txt';
  const f = new File(path, 'w'); arr.forEach(a => f.write(a + '\n')); f.close();
  console.log('[+] wrote ' + path);
}

// --- Strategy 2: probe a candidate memory-helper directly ---------------------
// Once a candidate function is identified (from coverage diff, or the translator
// experiment in HARNESS.md), attach and log any call whose address argument
// lands in the DS I/O / wireless range. The IO read/write helper is called
// constantly (every DISPSTAT/IF poll), so a true helper lights up immediately;
// filter for 0x048xxxxx to isolate wireless.
const WIFI_LO = 0x04800000, WIFI_HI = 0x04810000;
const IO_LO = 0x04000000, IO_HI = 0x05000000;
function probe(addr) {
  Interceptor.attach(addr, {
    onEnter(args) {
      // guest address is commonly in r0 or r1 for a read/write helper — log both
      for (let i = 0; i < 3; i++) {
        const v = args[i].toUInt32 ? args[i].toUInt32() : parseInt(args[i]);
        if (v >= IO_LO && v < IO_HI) {
          const tag = (v >= WIFI_LO && v < WIFI_HI) ? '  <<< WIRELESS' : '';
          console.log(`[probe ${addr}] arg${i}=0x${v.toString(16)}${tag}`);
          if (tag) console.log('   ' + Thread.backtrace(this.context, Backtracer.ACCURATE)
              .map(a => a.sub(mod.base).toString(16)).slice(0, 8).join(' '));
        }
      }
    }
  });
  console.log('[+] probing ' + addr + ' — watching for 0x048xxxxx args');
}

// --- Strategy 3: memory-access watch on the guest wireless buffer -------------
// If you locate the HOST buffer backing the guest I/O region (from the page
// table setup), watch it directly — every wireless read/write faults here with a
// backtrace to the accessing code.
function watchBuffer(hostPtr, size) {
  MemoryAccessMonitor.enable([{ base: hostPtr, size: size }], {
    onAccess(d) {
      console.log(`[watch] ${d.operation} @ ${d.address} from ${d.from.sub(mod.base)}`);
    }
  });
  console.log('[+] watching host buffer ' + hostPtr + ' (+0x' + size.toString(16) + ')');
}

hookJNI();
console.log('[i] commands: cov() / covStop() / probe(ptr) / watchBuffer(ptr,size)');
