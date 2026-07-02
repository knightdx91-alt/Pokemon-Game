// pml::pokepara — Pokémon stat calculation (HP + the five battle stats).
//
// Decompiled from Pokémon Ultra Moon (CTR-P-A2BA), exefs `.code`, via the
// symbol-mapped disassembly (tools/cro_disasm.py). Every branch of
// CoreParam::GetPower / GetMaxHp was traced; the result was verified
// numerically against Bulbapedia's canonical Garchomp worked example
// (all six stats match — see the commit message / decomp/README.md).
//
// Faithful research reconstruction, not a byte-matching recompile.
// Addresses are VA (text base 0x100000).

namespace pml {
namespace pokepara {

// PowerID order (the jump table at 0x3aef24): 0=HP 1=Atk 2=Def 3=SpA 4=SpD
// 5=Speed. GetPower(HP) tail-calls GetMaxHp; the other five share one core.
enum PowerID { POW_HP, POW_ATK, POW_DEF, POW_SPA, POW_SPD, POW_SPE };

// Nature effect on a given stat: +1 = boosted (×1.1), -1 = hindered (×0.9),
// 0 = neutral. Read from a 25×5 signed table (natures × the five non-HP
// stats), decoded in ApplyNature below (helper @ 0x223744).
extern signed char sNatureTable[25][5];  // -1 / 0 / +1

const int SPECIES_SHEDINJA = 0x124;  // 292 — hard-capped to 1 HP

// helper @ 0x223744 — apply the nature multiplier to a computed stat.
//   statIndex is 1..5 (Atk..Speed); HP (index 0) never gets here.
// The ROM does the ×110/100 and ×90/100 via a reciprocal-multiply (magic
// constant, >>22); integer *110/100 / *90/100 is the exact equivalent.
static unsigned int ApplyNature(unsigned int stat, int statIndex,
                                unsigned char nature)
{
    if ((unsigned)(statIndex - 1) >= 5)   // out of range -> unchanged
        return stat;
    signed char eff = sNatureTable[nature][statIndex - 1];
    if (eff == +1)
        return (stat * 110) / 100;
    if (eff == -1)
        return (stat * 90) / 100;
    return stat;                          // neutral (eff == 0)
}

// core @ 0x223860 (+ per-stat entry points that only vary statIndex) —
// the five battle stats.
//   stat = floor( (2*base + IV + EV/4) * level / 100 ) + 5, then × nature.
static unsigned int CalcStat(unsigned int base, unsigned int iv,
                             unsigned int ev, unsigned char level,
                             int statIndex, unsigned char nature)
{
    unsigned int v = (2 * base + iv + ev / 4) * level;
    v = v / 100 + 5;
    v &= 0xffff;                          // uxth in the ROM
    return ApplyNature(v, statIndex, nature);
}

// core @ 0x223960 — HP.
//   HP = floor( (2*base + IV + EV/4) * level / 100 ) + level + 10.
// Shedinja is special-cased to a flat 1 HP.
static unsigned int CalcHp(int species, unsigned int base, unsigned int iv,
                           unsigned int ev, unsigned char level)
{
    if (species == SPECIES_SHEDINJA)
        return 1;
    unsigned int v = (2 * base + iv + ev / 4) * level;
    return v / 100 + level + 10;
}

// pml::pokepara::CoreParam::GetPower(PowerID) const   @ 0x3aef18
// Dispatches on the stat, gathering level, IV (GetTalentPower), EV
// (GetEffortPower), base (personal data), nature (GetSeikaku), then calls
// the matching core above. (Egg / fast-mode early-outs at the head of each
// case read the raw cached value instead; omitted here for the pure math.)
unsigned int CoreParam::GetPower(PowerID id) const
{
    unsigned char level = GetLevel();
    unsigned char nature = GetSeikaku();
    int species = GetMonsNo();
    unsigned int base = GetBaseStat(species, GetFormNo(), id);
    unsigned int iv = GetTalentPower(id);   // 0..31
    unsigned int ev = GetEffortPower(id);   // 0..252

    if (id == POW_HP)
        return CalcHp(species, base, iv, ev, level);
    return CalcStat(base, iv, ev, level, /*statIndex=*/id, nature);
}

}  // namespace pokepara
}  // namespace pml
