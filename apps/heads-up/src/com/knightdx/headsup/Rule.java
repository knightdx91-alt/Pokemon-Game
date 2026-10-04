package com.knightdx.headsup;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import android.content.Context;
import android.content.SharedPreferences;

import java.util.ArrayList;
import java.util.List;

/** One "watch for this person" rule: a name to match and the sound to play. */
public class Rule {
    public String name = "";
    public String soundUri = "";   // content:// URI picked by the user ("" = default alarm)
    public String soundLabel = "";
    public boolean repeat = true;  // loop until the notification is opened/dismissed
    public boolean enabled = true;

    static final String PREFS = "headsup";
    static final String KEY_RULES = "rules";
    static final String KEY_FORCE_MAX = "force_max_volume";
    static final String KEY_MAX_SECONDS = "max_seconds";

    JSONObject toJson() throws JSONException {
        JSONObject o = new JSONObject();
        o.put("name", name);
        o.put("soundUri", soundUri);
        o.put("soundLabel", soundLabel);
        o.put("repeat", repeat);
        o.put("enabled", enabled);
        return o;
    }

    static Rule fromJson(JSONObject o) {
        Rule r = new Rule();
        r.name = o.optString("name", "");
        r.soundUri = o.optString("soundUri", "");
        r.soundLabel = o.optString("soundLabel", "");
        r.repeat = o.optBoolean("repeat", true);
        r.enabled = o.optBoolean("enabled", true);
        return r;
    }

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static List<Rule> load(Context c) {
        List<Rule> out = new ArrayList<>();
        try {
            JSONArray a = new JSONArray(prefs(c).getString(KEY_RULES, "[]"));
            for (int i = 0; i < a.length(); i++) out.add(fromJson(a.getJSONObject(i)));
        } catch (JSONException ignored) { }
        return out;
    }

    static void save(Context c, List<Rule> rules) {
        JSONArray a = new JSONArray();
        try {
            for (Rule r : rules) a.put(r.toJson());
        } catch (JSONException ignored) { }
        prefs(c).edit().putString(KEY_RULES, a.toString()).apply();
    }

    static boolean forceMaxVolume(Context c) {
        return prefs(c).getBoolean(KEY_FORCE_MAX, true);
    }

    static int maxSeconds(Context c) {
        return prefs(c).getInt(KEY_MAX_SECONDS, 60);
    }

    /** Case-insensitive match of this rule's name against any sender/title text. */
    boolean matches(List<String> candidates) {
        if (!enabled) return false;
        String needle = name.trim().toLowerCase();
        if (needle.isEmpty()) return false;
        for (String s : candidates) {
            if (s != null && s.toLowerCase().contains(needle)) return true;
        }
        return false;
    }
}
