#!/usr/bin/env bash
# Builds Heads Up without Gradle: aapt2 -> javac -> d8 -> zipalign -> apksigner.
# Needs: JDK 17+, Android SDK with platforms;android-34 + build-tools;34.0.0.
set -euo pipefail
cd "$(dirname "$0")"
SDK="${ANDROID_HOME:-/opt/android-sdk}"
BT="$SDK/build-tools/34.0.0"
JAR="$SDK/platforms/android-34/android.jar"
OUT=build
rm -rf "$OUT" && mkdir -p "$OUT/res" "$OUT/gen" "$OUT/classes" "$OUT/dex"

"$BT/aapt2" compile --dir res -o "$OUT/res/res.zip"
"$BT/aapt2" link -I "$JAR" --manifest AndroidManifest.xml --java "$OUT/gen" \
    -o "$OUT/unsigned.apk" "$OUT/res/res.zip"
javac -source 8 -target 8 -nowarn -Xlint:-options -bootclasspath "$JAR" -classpath "$JAR:$BT/core-lambda-stubs.jar" \
    -d "$OUT/classes" $(find src "$OUT/gen" -name '*.java')
"$BT/d8" --min-api 26 --lib "$JAR" --output "$OUT/dex" $(find "$OUT/classes" -name '*.class')
(cd "$OUT/dex" && zip -q ../unsigned.apk classes.dex)
"$BT/zipalign" -f 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"

# Same key every build so updates install over the old version.
if [ ! -f headsup.keystore ]; then
  keytool -genkeypair -keystore headsup.keystore -storepass headsup -keypass headsup \
    -alias headsup -keyalg RSA -keysize 2048 -validity 36500 -dname "CN=Heads Up"
fi
"$BT/apksigner" sign --ks headsup.keystore --ks-pass pass:headsup --key-pass pass:headsup \
    --out HeadsUp.apk "$OUT/aligned.apk"
"$BT/apksigner" verify HeadsUp.apk && echo "Built $(pwd)/HeadsUp.apk"
