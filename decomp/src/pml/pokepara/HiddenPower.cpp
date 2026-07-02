// pml::pokepara::CoreParam::GetMezapaType — Hidden Power ("Metcha Pattern"
// / めざめるパワー) type, derived from the low bit of each of the six IVs.
//
// Decompiled from Pokémon Ultra Moon (CTR-P-A2BA), exefs `.code` @ VA
// 0x3ae554 (gatherer) + 0x223498 (core), via the symbol-mapped disassembly
// (tools/cro_disasm.py). Faithful research reconstruction; verified against
// the documented Hidden Power type rule (all-even IVs → Fighting, all-odd →
// Dark).

namespace pml {
namespace pokepara {

enum HiddenPowerType {
    HP_FIGHTING, HP_FLYING, HP_POISON, HP_GROUND, HP_ROCK, HP_BUG, HP_GHOST,
    HP_STEEL, HP_FIRE, HP_WATER, HP_GRASS, HP_ELECTRIC, HP_PSYCHIC, HP_ICE,
    HP_DRAGON, HP_DARK,
};

// core @ 0x223498 — weight each IV's low bit (HP=1, Atk=2, Def=4, Speed=8,
// SpAtk=16, SpDef=32; note the Speed-before-special ordering), then scale the
// 0..63 sum into the 16 type slots: type = sum * 15 / 63.
static int HiddenPowerFromIVs(int hpIV, int atkIV, int defIV,
                              int speIV, int spaIV, int spdIV)
{
    int sum = (hpIV  & 1) * 1
            + (atkIV & 1) * 2
            + (defIV & 1) * 4
            + (speIV & 1) * 8
            + (spaIV & 1) * 16
            + (spdIV & 1) * 32;
    return (sum * 15) / 63;   // 0..15
}

// pml::pokepara::CoreParam::GetMezapaType() const   @ 0x3ae554
//   Uses the *native* (pre-Hyper-Training) IVs — GetNativeTalentPower — so
//   Hyper Training's stat-maxing does not change a Pokémon's Hidden Power.
HiddenPowerType CoreParam::GetMezapaType() const
{
    int hp  = GetNativeTalentPower(POW_HP);
    int atk = GetNativeTalentPower(POW_ATK);
    int def = GetNativeTalentPower(POW_DEF);
    int spa = GetNativeTalentPower(POW_SPA);
    int spd = GetNativeTalentPower(POW_SPD);
    int spe = GetNativeTalentPower(POW_SPE);
    return (HiddenPowerType)HiddenPowerFromIVs(hp, atk, def, spe, spa, spd);
}

}  // namespace pokepara
}  // namespace pml
