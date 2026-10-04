package com.knightdx.headsup;

import android.app.Notification;
import android.os.Bundle;
import android.os.Parcelable;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Android binds this service whenever notification access is granted and keeps
 * it running in the background — it receives the FULL notification (sender
 * name included) even when the lock screen is hiding the contents.
 */
public class ListenerService extends NotificationListenerService {
    private static final long COOLDOWN_MS = 8000;   // apps re-post the same notification a lot
    private final Map<String, Long> lastAlert = new HashMap<>();

    @Override
    public void onListenerConnected() {
        AlertPlayer.appContext = getApplicationContext();
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (getPackageName().equals(sbn.getPackageName())) return;
        Notification n = sbn.getNotification();
        if ((n.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;
        boolean isCall = Notification.CATEGORY_CALL.equals(n.category)
                || Notification.CATEGORY_MISSED_CALL.equals(n.category);
        // Skip ongoing stuff (music, downloads) except incoming calls.
        if ((n.flags & Notification.FLAG_ONGOING_EVENT) != 0 && !isCall) return;

        List<String> who = senderTexts(n);
        if (who.isEmpty()) return;

        for (Rule r : Rule.load(this)) {
            if (!r.matches(who)) continue;
            String coolKey = sbn.getPackageName() + "|" + r.name.toLowerCase();
            long now = System.currentTimeMillis();
            Long last = lastAlert.get(coolKey);
            if (last != null && now - last < COOLDOWN_MS) return;
            lastAlert.put(coolKey, now);
            AlertPlayer.play(this, r, sbn.getKey(), r.name);
            return;
        }
    }

    @Override
    public void onNotificationRemoved(StatusBarNotification sbn) {
        // You opened or swiped away her message -> stop the repeating alert.
        AlertPlayer.stopIfSource(this, sbn.getKey());
    }

    /** Sender names / conversation titles only — not message bodies, to avoid false matches. */
    private static List<String> senderTexts(Notification n) {
        List<String> out = new ArrayList<>();
        Bundle ex = n.extras;
        if (ex == null) return out;
        add(out, ex.getCharSequence(Notification.EXTRA_TITLE));
        add(out, ex.getCharSequence(Notification.EXTRA_TITLE_BIG));
        add(out, ex.getCharSequence(Notification.EXTRA_CONVERSATION_TITLE));
        // MessagingStyle (SMS, Messenger, WhatsApp...): each message carries its sender.
        Parcelable[] msgs = ex.getParcelableArray(Notification.EXTRA_MESSAGES);
        if (msgs != null) {
            for (Parcelable p : msgs) {
                if (p instanceof Bundle) {
                    Bundle b = (Bundle) p;
                    add(out, b.getCharSequence("sender"));
                    Object person = b.get("sender_person");
                    if (person instanceof android.app.Person) {
                        add(out, ((android.app.Person) person).getName());
                    }
                }
            }
        }
        return out;
    }

    private static void add(List<String> out, CharSequence cs) {
        if (cs != null && cs.length() > 0) out.add(cs.toString());
    }
}
