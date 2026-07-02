// pml::pokepara — experience ↔ level conversion.
//
// Decompiled from Pokémon Ultra Moon (CTR-P-A2BA), exefs `.code`, via the
// symbol-mapped disassembly (tools/cro_disasm.py). Faithful research
// reconstruction, not a byte-matching recompile. Addresses are VA
// (text base 0x100000).
//
// EXP curves are data-driven: each species has one of six growth-rate groups
// (Erratic / Fast / MediumFast / MediumSlow / Slow / Fluctuating). The per-
// group cumulative-EXP-at-level table is loaded by pml::personal from the
// growth NARC; the code here is the pure lookup/scan around it.

namespace pml {
namespace pokepara {

const int MAX_LEVEL = 100;

namespace personal {
// helpers @ 0x21d2c4 / 0x21e968 — load a species' growth table, then read the
// minimum cumulative EXP required to *be* a given level (level 1 == 0).
void LoadGrowTable(int species, unsigned char form);   // 0x21d2c4
unsigned int GetMinExp(unsigned char level);           // 0x21e968
}

// core @ 0x223918 — level implied by a raw EXP total.
//   Scan levels 1..100; the level is the highest whose GetMinExp() does not
//   exceed `exp` (i.e. stop at the first level that requires more EXP than we
//   have, then step back one). Never returns < 1.
unsigned char CalcLevelFromExp(int species, unsigned char form,
                               unsigned int exp)
{
    personal::LoadGrowTable(species, form);
    int level = 1;
    while (level <= MAX_LEVEL) {
        if (personal::GetMinExp((unsigned char)level) > exp)  // bhi -> break
            break;
        ++level;
    }
    level -= 1;
    return (unsigned char)(level <= 0 ? 1 : level);
}

// pml::pokepara::CoreParam::GetExpForNextLevel() const   @ 0x21e924
//   EXP threshold to reach the next level (capped at level 100). At level 100
//   this returns the level-100 threshold (no further growth).
unsigned int CoreParam::GetExpForNextLevel() const
{
    int next = GetLevel() + 1;
    if (next > MAX_LEVEL)
        next = MAX_LEVEL;
    personal::LoadGrowTable(GetMonsNo(), GetFormNo());
    return personal::GetMinExp((unsigned char)next);
}

// pml::pokepara::CoreParam::GetExpForCurrentLevel() const  @ 0x3aeb38
//   EXP threshold at which the current level began (the sibling of the above;
//   same shape, using the current level instead of level+1).
unsigned int CoreParam::GetExpForCurrentLevel() const
{
    personal::LoadGrowTable(GetMonsNo(), GetFormNo());
    return personal::GetMinExp(GetLevel());
}

}  // namespace pokepara
}  // namespace pml
