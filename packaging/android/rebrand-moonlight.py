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

# Add a guarded Alt+F4 control for fullscreen sessions. DeX reserves Alt+F4
# for closing the local Android app, so this gives the user an explicit way
# to send that shortcut to the Windows host instead.
game = gradle.parent / "src" / "main" / "java" / "com" / "limelight" / "Game.java"
game_text = game.read_text(encoding="utf-8")

field_anchor = '    private boolean connected = false;\n'
field_patch = field_anchor + '    private android.widget.TextView remoteCloseButton;\n'
if game_text.count(field_anchor) != 1:
    raise SystemExit("Expected exactly one connected state in pinned Moonlight Game.java")
game_text = game_text.replace(field_anchor, field_patch, 1)

view_anchor = '        streamView.setInputCallbacks(this);\n'
view_patch = view_anchor + '        createRemoteCloseButton();\n'
if game_text.count(view_anchor) != 1:
    raise SystemExit("Expected exactly one stream input callback setup in pinned Moonlight Game.java")
game_text = game_text.replace(view_anchor, view_patch, 1)

connected_anchor = '                connected = true;\n'
connected_patch = connected_anchor + '                updateRemoteCloseButtonVisibility();\n'
if game_text.count(connected_anchor) != 1:
    raise SystemExit("Expected exactly one successful connection state in pinned Moonlight Game.java")
game_text = game_text.replace(connected_anchor, connected_patch, 1)

multiwindow_anchor = '        super.onMultiWindowModeChanged(isInMultiWindowMode);\n'
multiwindow_patch = multiwindow_anchor + '        updateRemoteCloseButtonVisibility();\n'
if game_text.count(multiwindow_anchor) != 1:
    raise SystemExit("Expected exactly one multi-window callback in pinned Moonlight Game.java")
game_text = game_text.replace(multiwindow_anchor, multiwindow_patch, 1)

method_anchor = '    private void hideSystemUi(int delay) {\n'
method = '''    private int remoteCloseDp(float value) {
        return (int) (value * getResources().getDisplayMetrics().density + 0.5f);
    }

    private void createRemoteCloseButton() {
        android.widget.FrameLayout content = findViewById(android.R.id.content);
        if (content == null) {
            return;
        }

        remoteCloseButton = new android.widget.TextView(this);
        remoteCloseButton.setText("×");
        remoteCloseButton.setTextSize(22);
        remoteCloseButton.setTextColor(0xFFFFFFFF);
        remoteCloseButton.setGravity(android.view.Gravity.CENTER);
        remoteCloseButton.setContentDescription("Segure por 1 segundo para enviar Alt+F4 ao PC");

        android.graphics.drawable.GradientDrawable background = new android.graphics.drawable.GradientDrawable();
        background.setShape(android.graphics.drawable.GradientDrawable.OVAL);
        background.setColor(0x990A0F18);
        background.setStroke(remoteCloseDp(1), 0x66FFFFFF);
        remoteCloseButton.setBackground(background);
        remoteCloseButton.setElevation(remoteCloseDp(6));
        remoteCloseButton.setAlpha(0.55f);
        remoteCloseButton.setVisibility(View.GONE);

        android.widget.FrameLayout.LayoutParams params = new android.widget.FrameLayout.LayoutParams(
                remoteCloseDp(42), remoteCloseDp(42), android.view.Gravity.TOP | android.view.Gravity.RIGHT);
        params.setMargins(0, remoteCloseDp(18), remoteCloseDp(18), 0);
        content.addView(remoteCloseButton, params);

        final long[] pressStartedAt = {0};
        final boolean[] movedAway = {false};
        remoteCloseButton.setOnTouchListener((view, event) -> {
            switch (event.getActionMasked()) {
                case android.view.MotionEvent.ACTION_DOWN:
                    pressStartedAt[0] = android.os.SystemClock.elapsedRealtime();
                    movedAway[0] = false;
                    view.setAlpha(0.95f);
                    return true;
                case android.view.MotionEvent.ACTION_MOVE:
                    if (event.getX() < 0 || event.getY() < 0 ||
                            event.getX() > view.getWidth() || event.getY() > view.getHeight()) {
                        movedAway[0] = true;
                        view.setAlpha(0.35f);
                    }
                    return true;
                case android.view.MotionEvent.ACTION_UP:
                    long heldFor = android.os.SystemClock.elapsedRealtime() - pressStartedAt[0];
                    view.setAlpha(0.55f);
                    if (!movedAway[0] && heldFor >= 1000) {
                        sendAltF4ToHost();
                    }
                    else if (!movedAway[0]) {
                        android.widget.Toast.makeText(Game.this,
                                "Segure o botão por 1 segundo para enviar Alt+F4 ao PC.",
                                android.widget.Toast.LENGTH_SHORT).show();
                    }
                    return true;
                case android.view.MotionEvent.ACTION_CANCEL:
                    view.setAlpha(0.55f);
                    movedAway[0] = true;
                    return true;
                default:
                    return true;
            }
        });
    }

    private void updateRemoteCloseButtonVisibility() {
        if (remoteCloseButton != null) {
            boolean fullscreen = Build.VERSION.SDK_INT < Build.VERSION_CODES.N || !isInMultiWindowMode();
            remoteCloseButton.setVisibility(connected && fullscreen ? View.VISIBLE : View.GONE);
        }
    }

    private void sendAltF4ToHost() {
        if (!connected || conn == null || keyboardTranslator == null) {
            return;
        }

        short f4 = keyboardTranslator.translate(KeyEvent.KEYCODE_F4, -1);
        if (f4 == 0) {
            android.widget.Toast.makeText(this, "Não foi possível enviar Alt+F4 ao PC.",
                    android.widget.Toast.LENGTH_SHORT).show();
            return;
        }

        conn.sendKeyboardInput(f4, KeyboardPacket.KEY_DOWN, KeyboardPacket.MODIFIER_ALT, (byte) 0);
        conn.sendKeyboardInput(f4, KeyboardPacket.KEY_UP, KeyboardPacket.MODIFIER_ALT, (byte) 0);
    }

'''
if game_text.count(method_anchor) != 1:
    raise SystemExit("Expected exactly one hideSystemUi method in pinned Moonlight Game.java")
game_text = game_text.replace(method_anchor, method + method_anchor, 1)
game.write_text(game_text, encoding="utf-8")
