// pml::pokepara::CoreParam::IsRare — shininess check ("rare colour").
//
// Decompiled from Pokémon Ultra Moon (CTR-P-A2BA), exefs `.code` @ VA 0x2232d0,
// via the symbol-mapped disassembly (tools/cro_disasm.py). Faithful research
// reconstruction. Matches the documented Gen-6/7 shiny rule exactly.

namespace pml {
namespace pokepara {

// A Pokémon is shiny when the trainer ID, secret ID, and the two halves of the
// personality value (PID) XOR to a value below the shininess threshold.
// Gen 6/7 tightened this threshold from 8 (Gen 5) to 16.
const unsigned int SHINY_THRESHOLD = 16;

// pml::pokepara::CoreParam::IsRare() const   @ 0x2232d0
//   id  = GetID()          — 32-bit OT identifier: TID in bits 0..15,
//                            SID (secret ID) in bits 16..31.
//   pid = GetPersonalRnd()  — 32-bit personality value.
// shiny  <=>  (TID ^ SID ^ PID_hi ^ PID_lo) < 16.
bool CoreParam::IsRare() const
{
    unsigned int id = GetID();            // sub_3adae4
    unsigned int pid = GetPersonalRnd();  // sub_3acc28

    unsigned int tid = id & 0xffff;
    unsigned int sid = id >> 16;
    unsigned int pidLo = pid & 0xffff;
    unsigned int pidHi = pid >> 16;

    unsigned int shinyValue = tid ^ sid ^ pidHi ^ pidLo;
    return shinyValue < SHINY_THRESHOLD;
}

}  // namespace pokepara
}  // namespace pml
