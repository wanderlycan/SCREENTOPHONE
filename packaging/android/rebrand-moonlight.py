from pathlib import Path
import sys

gradle = Path(sys.argv[1])
text = gradle.read_text(encoding="utf-8")
old_id = 'applicationId "com.limelight"'
new_id = 'applicationId "app.smarttoscreen.client"'
if text.count(old_id) != 1:
    raise SystemExit("Expected exactly one non-root application ID in pinned Moonlight source")
text = text.replace(old_id, new_id, 1)
old_compile_sdk = "    compileSdk 37\n"
new_compile_sdk = "    compileSdk 37\n    compileSdkMinor 0\n"
if text.count(old_compile_sdk) != 1:
    raise SystemExit("Expected exactly one Android 17 compile SDK declaration in pinned Moonlight source")
text = text.replace(old_compile_sdk, new_compile_sdk, 1)
old_label = 'resValue "string", "app_label", "Moonlight"'
new_label = 'resValue "string", "app_label", "SmartToScreen"'
if text.count(old_label) != 1:
    raise SystemExit("Expected exactly one release label in pinned Moonlight source")
text = text.replace(old_label, new_label, 1)
old_debug_label = 'resValue "string", "app_label", "Moonlight (Debug)"'
new_debug_label = 'resValue "string", "app_label", "SmartToScreen Beta"'
if text.count(old_debug_label) != 1:
    raise SystemExit("Expected exactly one debug label in pinned Moonlight source")
text = text.replace(old_debug_label, new_debug_label, 1)
gradle.write_text(text, encoding="utf-8")

