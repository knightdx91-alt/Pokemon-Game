# Citra gdbstub client + seq-dispatch hook analyzer (USUM live-capture route)

> **TL;DR — for the effect→sequence dispatch, DON'T use the gdbstub.** It is
> memory-read-only in this fork (breakpoints/watchpoints/registers are dead — see
> the matrix below). The working solution is the **in-process JIT read-watch
> hook** (`decomp/citra/effect_seq_hook.patch`): arm `/tmp/hook_arm`, read
> `/tmp/hook_out`, analyze with **`hookcap.py`** (in this dir). Usage +
> captured traces: `decomp/citra/README.md` / `decomp/battle_effects/
> EFFECT_DISPATCH.md`. The gdbstub client below is kept because its **memory
> read + halt** primitives still work and are useful for one-off inspection.

The prebuilt Citra (`decomp/citra/prebuilt/citra`) accepts `--gdbport <n>` and
exposes the classic Citra RSP gdbstub. These files are a tiny, dependency-free
client for driving it from Python, because the stub only accepts **one** TCP
connection for its whole lifetime (reconnecting fails), so a single long-lived
owner process is required.

- `hookcap.py` — analyzer for the JIT read-watch hook's `/tmp/hook_out` (NOT
  gdb): parses `<vaddr> <r0..r15>` lines into `seqId=(vaddr-seqtbl)/8` traces.

- `rsp.py` — minimal RSP protocol (packets, `m` read, `M`, `g` regs, `Z0/z0`
  breakpoints, `Z2/3/4` watchpoints, Ctrl-C interrupt, continue). `cmd()` drains
  any stale packet first to stay in sync.
- `rspd.py` — daemon that owns the one connection. Reads JSON commands (one per
  line) from `/tmp/rsp_in`, appends JSON results to `/tmp/rsp_out`.
  ops: `cont`, `interrupt`, `wait{timeout}`, `bp{addr}`, `unbp`, `wp{addr,len,kind}`,
  `unwp`, `regs`, `mem{addr,len,file}`, `quit`.
- `rspctl.py` — one-shot sender: `rspctl.py '<json>' [wait_s]` appends to
  `/tmp/rsp_in`, prints the new `/tmp/rsp_out` line(s).

## Boot + attach
```
CITRA_AUTOPILOT=1 LIBGL_ALWAYS_SOFTWARE=1 xvfb-run -a \
  decomp/citra/prebuilt/citra --gdbport 24689 "<ultramoon>.3ds" > /tmp/citra.log 2>&1 &
# wait for "Waiting for gdb to connect..."
python3 tools/citra_gdb/rspd.py >> /tmp/rspd.log 2>&1 &   # emits {"ev":"connected"}
python3 tools/citra_gdb/rspctl.py '{"op":"cont"}'         # run the game
```
Input/screenshots use the autopilot channels (`/tmp/ap_key`, `/tmp/shot`); under
the gdbstub the emulator runs slower, so hold buttons ~500 ms (short taps miss).

## IMPORTANT — what this stub CAN and CANNOT do (verified 2026-07, USUM run)

Tested against a live wild battle with Battle.cro's base re-confirmed in-session
(the queue-base literal at `sub_8790c`+lit VA `0x764b54` read back `0x8146e8c` ==
bss+0x394 exactly, so all addresses below were correct):

| feature | works? | notes |
|---|---|---|
| memory read (`m`) | ✅ | returns real (relocated) process memory; the reliable primitive |
| interrupt / halt (Ctrl-C) | ✅ (flaky) | halts; stop reply is `T05` or sometimes empty |
| register read (`g`, `p`) | ❌ | returns **all zeros** even when halted — context not wired |
| exec breakpoint (`Z0`) | ❌ | accepted `OK`, **never fires** (tried `sub_8790c` @ `0x764a8c`) |
| read/access watchpoint (`Z3/Z4`) | ❌ | accepted `OK`, **never fires** (tried seq table `0x7de5a0`,len `0x4c8`) |

**Consequence for the effect→sequence remap:** you cannot catch the dispatch by
breaking on the push site or watching the seq-table with this binary, and you
cannot read `r4`(=`work`) at a handler because registers are dead. The seqId at
`work+0xa94` is reachable **only** via memory-read once `work`'s address is known.

## Viable next steps (both avoid the dead gdbstub control path)
1. **Rebuild Citra with an in-process dump** at the dispatch site (recommended) —
   the frontend patch already has `/tmp/dump_va`; add a hook in the CPU/JIT that,
   when PC hits the `table[seqId]` call (or `sub_86e48`'s push), snapshots the
   effectId register and `work+0xa94`. No gdb needed.
2. **Static: name the `work` global**, then use the WORKING gdb primitives
   (halt + memory read): launch a move, interrupt mid-move (multi-frame, easy to
   catch — unlike the sub-frame event), read `[work_global]`, deref `+0xa94` =
   seqId; effectId is known from the chosen move. Correlate two moves with
   distinct effectIds to confirm.
