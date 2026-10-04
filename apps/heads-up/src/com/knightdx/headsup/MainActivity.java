package com.knightdx.headsup;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.OpenableColumns;
import android.provider.Settings;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import java.util.List;

public class MainActivity extends Activity {
    private static final int BG = Color.parseColor("#14141C");
    private static final int CARD = Color.parseColor("#22222E");
    private static final int ACCENT = Color.parseColor("#E0245E");
    private static final int TEXT = Color.parseColor("#EEEEF4");
    private static final int MUTED = Color.parseColor("#9A9AB0");

    private LinearLayout root;
    private List<Rule> rules;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1);
        }
        AlertPlayer.ensureChannel(this);
    }

    @Override
    protected void onResume() {
        super.onResume();
        render();
    }

    private void render() {
        rules = Rule.load(this);
        ScrollView sv = new ScrollView(this);
        sv.setBackgroundColor(BG);
        root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        int p = dp(16);
        root.setPadding(p, dp(24), p, dp(32));
        sv.addView(root);

        TextView title = text("Heads Up", 26, TEXT);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        root.addView(title);
        root.addView(text("Plays your sound — loud — when someone you pick messages or calls.", 14, MUTED));

        // ---- Setup / status ----
        LinearLayout setup = card("Setup");
        boolean access = hasNotificationAccess();
        setup.addView(status("Notification access", access));
        if (!access) {
            setup.addView(button("Grant notification access", v ->
                    startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))));
        }
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        boolean unrestricted = pm.isIgnoringBatteryOptimizations(getPackageName());
        setup.addView(status("Allowed to run 24/7 (battery)", unrestricted));
        if (!unrestricted) {
            setup.addView(button("Allow running in background", v -> {
                Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                i.setData(Uri.parse("package:" + getPackageName()));
                startActivity(i);
            }));
        }
        CheckBox loud = new CheckBox(this);
        loud.setText("Force max volume (even on silent/vibrate)");
        loud.setTextColor(TEXT);
        loud.setChecked(Rule.forceMaxVolume(this));
        loud.setOnCheckedChangeListener((cb, on) ->
                Rule.prefs(this).edit().putBoolean(Rule.KEY_FORCE_MAX, on).apply());
        setup.addView(loud);

        LinearLayout secRow = row();
        secRow.addView(text("Repeat alerts stop after (seconds): ", 14, TEXT));
        EditText secs = new EditText(this);
        secs.setInputType(InputType.TYPE_CLASS_NUMBER);
        secs.setText(String.valueOf(Rule.maxSeconds(this)));
        secs.setTextColor(TEXT);
        secs.setEms(3);
        secs.setOnFocusChangeListener((v, has) -> {
            if (!has) saveSeconds(secs);
        });
        secRow.addView(secs);
        setup.addView(secRow);

        if (AlertPlayer.isPlaying()) {
            Button stop = button("■ STOP ALERT", v -> { AlertPlayer.stop(this); render(); });
            setup.addView(stop);
        }

        // ---- Add person ----
        LinearLayout add = card("Add a person");
        add.addView(text("Type their name exactly how it shows in your contacts / Messenger "
                + "(a first name is enough — it matches any part of the name).", 13, MUTED));
        LinearLayout addRow = row();
        EditText name = new EditText(this);
        name.setHint("Name");
        name.setHintTextColor(MUTED);
        name.setTextColor(TEXT);
        name.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_WORDS);
        addRow.addView(name, new LinearLayout.LayoutParams(0, -2, 1));
        addRow.addView(button("Add", v -> {
            String n = name.getText().toString().trim();
            if (n.isEmpty()) return;
            Rule r = new Rule();
            r.name = n;
            rules.add(r);
            Rule.save(this, rules);
            pickSound(rules.size() - 1);   // go straight to choosing their sound
        }));
        add.addView(addRow);

        // ---- People ----
        LinearLayout people = card(rules.isEmpty() ? "People (none yet)" : "People");
        for (int i = 0; i < rules.size(); i++) people.addView(ruleView(i));

        setContentView(sv);
    }

    private View ruleView(int i) {
        Rule r = rules.get(i);
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(0, dp(10), 0, dp(10));

        TextView n = text(r.name, 18, r.enabled ? TEXT : MUTED);
        n.setTypeface(Typeface.DEFAULT_BOLD);
        box.addView(n);
        box.addView(text("Sound: " + (r.soundLabel.isEmpty() ? "Default alarm" : r.soundLabel), 13, MUTED));

        CheckBox rep = new CheckBox(this);
        rep.setText("Repeat until I open/dismiss the message");
        rep.setTextColor(TEXT);
        rep.setChecked(r.repeat);
        rep.setOnCheckedChangeListener((cb, on) -> { r.repeat = on; Rule.save(this, rules); });
        box.addView(rep);

        CheckBox en = new CheckBox(this);
        en.setText("Enabled");
        en.setTextColor(TEXT);
        en.setChecked(r.enabled);
        en.setOnCheckedChangeListener((cb, on) -> { r.enabled = on; Rule.save(this, rules); render(); });
        box.addView(en);

        LinearLayout btns = row();
        btns.addView(button("Pick sound", v -> pickSound(i)));
        btns.addView(button("Test", v -> {
            AlertPlayer.play(this, r, "test", r.name);
            render();
        }));
        btns.addView(button("Delete", v -> new AlertDialog.Builder(this)
                .setMessage("Remove " + r.name + "?")
                .setPositiveButton("Remove", (d, w) -> { rules.remove(i); Rule.save(this, rules); render(); })
                .setNegativeButton("Cancel", null).show()));
        box.addView(btns);
        return box;
    }

    private void pickSound(int index) {
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType("audio/*");
        startActivityForResult(i, 100 + index);
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        int index = req - 100;
        if (res != RESULT_OK || data == null || data.getData() == null) return;
        rules = Rule.load(this);
        if (index < 0 || index >= rules.size()) return;
        Uri uri = data.getData();
        try {
            // Keep access to the file after reboots.
            getContentResolver().takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
        } catch (SecurityException e) {
            Toast.makeText(this, "Couldn't keep access to that file — try another", Toast.LENGTH_LONG).show();
        }
        Rule r = rules.get(index);
        r.soundUri = uri.toString();
        r.soundLabel = displayName(uri);
        Rule.save(this, rules);
        render();
    }

    private String displayName(Uri uri) {
        try (Cursor c = getContentResolver().query(uri, new String[]{OpenableColumns.DISPLAY_NAME},
                null, null, null)) {
            if (c != null && c.moveToFirst()) return c.getString(0);
        } catch (Exception ignored) { }
        return uri.getLastPathSegment();
    }

    private void saveSeconds(EditText e) {
        int s;
        try { s = Integer.parseInt(e.getText().toString()); } catch (NumberFormatException x) { s = 60; }
        s = Math.max(5, Math.min(600, s));
        Rule.prefs(this).edit().putInt(Rule.KEY_MAX_SECONDS, s).apply();
    }

    private boolean hasNotificationAccess() {
        String flat = Settings.Secure.getString(getContentResolver(), "enabled_notification_listeners");
        if (flat == null) return false;
        String me = new ComponentName(this, ListenerService.class).flattenToString();
        for (String s : flat.split(":")) if (s.equals(me)) return true;
        return false;
    }

    // ---- tiny view helpers ----
    private int dp(int v) { return Math.round(v * getResources().getDisplayMetrics().density); }

    private TextView text(String s, int sp, int color) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(sp);
        t.setTextColor(color);
        t.setPadding(0, dp(2), 0, dp(2));
        return t;
    }

    private TextView status(String label, boolean ok) {
        TextView t = text((ok ? "✓  " : "✗  ") + label, 15, ok ? Color.parseColor("#4CD964") : Color.parseColor("#FF6B6B"));
        return t;
    }

    private Button button(String s, View.OnClickListener l) {
        Button btn = new Button(this);
        btn.setText(s);
        btn.setAllCaps(false);
        btn.setTextColor(Color.WHITE);
        GradientDrawable g = new GradientDrawable();
        g.setColor(ACCENT);
        g.setCornerRadius(dp(8));
        btn.setBackground(g);
        btn.setOnClickListener(l);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-2, -2);
        lp.setMargins(0, dp(6), dp(8), dp(2));
        btn.setLayoutParams(lp);
        return btn;
    }

    private LinearLayout row() {
        LinearLayout r = new LinearLayout(this);
        r.setOrientation(LinearLayout.HORIZONTAL);
        r.setGravity(Gravity.CENTER_VERTICAL);
        return r;
    }

    private LinearLayout card(String heading) {
        LinearLayout c = new LinearLayout(this);
        c.setOrientation(LinearLayout.VERTICAL);
        int p = dp(14);
        c.setPadding(p, p, p, p);
        GradientDrawable g = new GradientDrawable();
        g.setColor(CARD);
        g.setCornerRadius(dp(12));
        c.setBackground(g);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
        lp.setMargins(0, dp(16), 0, 0);
        root.addView(c, lp);
        TextView h = text(heading, 17, TEXT);
        h.setTypeface(Typeface.DEFAULT_BOLD);
        c.addView(h);
        return c;
    }
}
