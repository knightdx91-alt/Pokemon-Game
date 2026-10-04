package com.knightdx.headsup;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;

/**
 * Plays the chosen sound LOUD: routed through the alarm stream (so it sounds
 * even when the phone is on silent/vibrate and through Do Not Disturb's
 * "alarms" exception), with the alarm volume pushed to max for the duration
 * and restored afterwards.
 */
public final class AlertPlayer {
    static final String CHANNEL = "alerts";
    static final int NOTIF_ID = 4242;

    private static MediaPlayer player;
    private static String activeKey;          // source notification key we're alerting for
    private static int savedAlarmVolume = -1;
    private static AudioFocusRequest focus;
    private static PowerManager.WakeLock wake;
    private static final Handler main = new Handler(Looper.getMainLooper());
    private static final Runnable timeout = () -> stop(null);

    private AlertPlayer() { }

    public static synchronized boolean isPlaying() { return player != null; }

    public static synchronized void play(Context ctx, Rule rule, String sourceKey, String who) {
        Context c = ctx.getApplicationContext();
        stopInternal(c);

        AudioManager am = (AudioManager) c.getSystemService(Context.AUDIO_SERVICE);
        if (Rule.forceMaxVolume(c)) {
            savedAlarmVolume = am.getStreamVolume(AudioManager.STREAM_ALARM);
            am.setStreamVolume(AudioManager.STREAM_ALARM,
                    am.getStreamMaxVolume(AudioManager.STREAM_ALARM), 0);
        }

        AudioAttributes attrs = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
        focus = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                .setAudioAttributes(attrs).build();
        am.requestAudioFocus(focus);

        Uri uri = rule.soundUri.isEmpty()
                ? RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                : Uri.parse(rule.soundUri);
        MediaPlayer mp = new MediaPlayer();
        try {
            mp.setAudioAttributes(attrs);
            mp.setDataSource(c, uri);
            mp.setLooping(rule.repeat);
            mp.setVolume(1f, 1f);
            mp.prepare();
        } catch (Exception e) {
            // Picked file vanished or permission lost: fall back to the default alarm tone.
            mp.release();
            mp = new MediaPlayer();
            try {
                mp.setAudioAttributes(attrs);
                mp.setDataSource(c, RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM));
                mp.setLooping(rule.repeat);
                mp.prepare();
            } catch (Exception e2) {
                mp.release();
                restoreVolume(c);
                return;
            }
        }
        if (!rule.repeat) mp.setOnCompletionListener(p -> stop(c));
        player = mp;
        activeKey = sourceKey;
        mp.start();

        PowerManager pm = (PowerManager) c.getSystemService(Context.POWER_SERVICE);
        wake = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "headsup:alert");
        wake.acquire((Rule.maxSeconds(c) + 5) * 1000L);

        Vibrator vib = (Vibrator) c.getSystemService(Context.VIBRATOR_SERVICE);
        if (vib != null) vib.vibrate(VibrationEffect.createWaveform(new long[]{0, 400, 200, 400}, -1));

        main.removeCallbacks(timeout);
        main.postDelayed(timeout, Rule.maxSeconds(c) * 1000L);
        showStopNotification(c, who);
    }

    /** Stop only if we're alerting for this source notification (it was opened/dismissed). */
    public static synchronized void stopIfSource(Context c, String key) {
        if (activeKey != null && activeKey.equals(key)) stopInternal(c.getApplicationContext());
    }

    public static synchronized void stop(Context c) {
        stopInternal(c);
    }

    private static void stopInternal(Context c) {
        main.removeCallbacks(timeout);
        if (player != null) {
            try { player.stop(); } catch (Exception ignored) { }
            player.release();
            player = null;
        }
        activeKey = null;
        if (wake != null && wake.isHeld()) wake.release();
        wake = null;
        if (c == null) c = appContext;
        if (c != null) {
            AudioManager am = (AudioManager) c.getSystemService(Context.AUDIO_SERVICE);
            if (focus != null) am.abandonAudioFocusRequest(focus);
            focus = null;
            restoreVolume(c);
            ((NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE)).cancel(NOTIF_ID);
        }
    }

    static Context appContext;   // set by the listener so the timeout can clean up

    private static void restoreVolume(Context c) {
        if (savedAlarmVolume >= 0) {
            AudioManager am = (AudioManager) c.getSystemService(Context.AUDIO_SERVICE);
            am.setStreamVolume(AudioManager.STREAM_ALARM, savedAlarmVolume, 0);
            savedAlarmVolume = -1;
        }
    }

    static void ensureChannel(Context c) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        NotificationChannel ch = new NotificationChannel(CHANNEL, "Alert controls",
                NotificationManager.IMPORTANCE_HIGH);
        ch.setSound(null, null);   // the app plays its own sound
        ch.enableVibration(false);
        nm.createNotificationChannel(ch);
    }

    private static void showStopNotification(Context c, String who) {
        appContext = c;
        ensureChannel(c);
        PendingIntent stopPi = PendingIntent.getBroadcast(c, 0,
                new Intent(c, StopReceiver.class),
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification n = new Notification.Builder(c, CHANNEL)
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setContentTitle("Message from " + who)
                .setContentText("Tap to stop the alert")
                .setContentIntent(stopPi)
                .setDeleteIntent(stopPi)
                .addAction(new Notification.Action.Builder(null, "STOP", stopPi).build())
                .setCategory(Notification.CATEGORY_ALARM)
                .setAutoCancel(true)
                .build();
        ((NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE)).notify(NOTIF_ID, n);
    }
}
