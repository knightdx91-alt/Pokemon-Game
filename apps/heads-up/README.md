# Heads Up (Android)

Plays a sound you pick, at max volume through the alarm stream, when a
notification arrives from someone on your list: SMS, Messenger, WhatsApp,
Instagram, calls, or any other app that puts the sender's name in its
notification. It uses Android's notification-listener API, so it sees the
sender even while the lock screen hides the notification's contents.

- Install: download `HeadsUp.apk` and open it (allow "install unknown apps").
- Build: `./build.sh` (plain SDK toolchain, no Gradle). Keep `headsup.keystore`
  so updates install over the previous version.
