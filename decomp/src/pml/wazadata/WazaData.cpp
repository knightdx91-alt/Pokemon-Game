// pml::wazadata — move (waza) data accessor API  (Pokémon Ultra Moon)
//
// Decompiled from static.crs (exefs .code). This is the authoritative accessor
// layer over the loaded move table (GARC move records). The battle engine and
// UI read every move property through these. The raw record extraction that
// produced data/pokemon/usum_moves.json read the GARC bytes directly; this file
// documents the game's own API for the same data.
//
// ── Dispatch (GetParam @0x2267d0) ───────────────────────────────────────────
// All scalar properties funnel through:
//     GetParam(WazaNo waza, ParamID id)
//   with bounds waza <= 0x2d8 (728) and id < 0x25 (37). It resolves the move's
//   record via a small fixed-size record cache (sub_22645c: linear scan of the
//   loaded slots by WazaNo, with a round-robin replacement index kept at
//   cache+9 via uidivmod by the slot count), loading the record on miss
//   (sub_226b00), then reads field `id` from the parsed record with sub_3af788.
//   sub_3af788 walks a parsed structure (NOT a flat offset table) — which is
//   why the data extraction read raw GARC records instead.
//
// Named accessors are 4-byte thunks that set r1=ParamID and fall through into
// GetParam. Recovered ParamID enum (verified from the thunk constants):
enum ParamID {
    PARAM_TYPE        = 0,   // GetType         -> PokeType
    PARAM_CATEGORY    = 1,   // GetCategory
    PARAM_DAMAGE_TYPE = 2,   // GetDamageType   -> physical/special/status
    PARAM_POWER       = 3,   // GetPower / IsDamage (power>0)
    PARAM_ALWAYS_HIT  = 31,  // IsAlwaysHit     -> accuracy==0 sentinel
    PARAM_ZWAZA_NO    = 32,  // GetZenryokuWazaNo (Z-move id)
    PARAM_ZWAZA_EFFECT= 34,  // GetZenryokuWazaEffect
    // 4..30, 33, 35, 36 exist (bound is <37) but have no dedicated named
    // accessor; reached by GetParam(id) directly from the battle scripts.
};

#include <cstdint>
namespace pml { namespace wazadata {

typedef uint16_t WazaNo;

int  GetParam(WazaNo waza, ParamID id);       // sub_2267d0 (bounds-checked)

// Thin thunks over GetParam (each is `mov r1,#id ; b GetParam`):
int  GetType(WazaNo w)          { return GetParam(w, PARAM_TYPE); }        // 0
int  GetCategory(WazaNo w)      { return GetParam(w, PARAM_CATEGORY); }    // 1
int  GetDamageType(WazaNo w)    { return GetParam(w, PARAM_DAMAGE_TYPE); } // 2
int  GetPower(WazaNo w)         { return GetParam(w, PARAM_POWER); }       // 3
bool IsDamage(WazaNo w)         { return GetParam(w, PARAM_POWER) != 0; }  // 3
bool IsAlwaysHit(WazaNo w)      { return GetParam(w, PARAM_ALWAYS_HIT); }  // 31
int  GetZenryokuWazaNo(WazaNo w){ return GetParam(w, PARAM_ZWAZA_NO); }    // 32
int  GetZenryokuWazaEffect(WazaNo w){ return GetParam(w, PARAM_ZWAZA_EFFECT); } // 34

// GetFlag/GetMaxPP/GetWeather/GetSickCont/GetRankEffect are separate (they read
// composite fields, not a single ParamID scalar) — see their own sub_* bodies.

}} // namespace pml::wazadata
