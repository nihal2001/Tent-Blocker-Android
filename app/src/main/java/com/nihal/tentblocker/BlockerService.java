package com.nihal.tentblocker;
import android.accessibilityservice.AccessibilityService;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.view.accessibility.AccessibilityEvent;
import android.widget.Toast;

public final class BlockerService extends AccessibilityService {
    private final Handler handler = new Handler(Looper.getMainLooper());
    private String foreground = "";
    private Preferences prefs;
    private long lastBlocked;
    private final Runnable check = new Runnable() {
        @Override public void run() { enforce(); handler.postDelayed(this,1000); }
    };
    @Override protected void onServiceConnected() {
        prefs = new Preferences(this);
        handler.removeCallbacks(check); handler.post(check);
    }
    @Override public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event.getPackageName() != null && event.getClassName() != null) {
            foreground = event.getPackageName().toString(); enforce();
        }
    }
    private void enforce() {
        if (prefs == null || !((PowerManager)getSystemService(POWER_SERVICE)).isInteractive()) return;
        String app = foreground.equals("com.instagram.android") ? "instagram" : foreground.equals("com.google.android.youtube") ? "youtube" : null;
        if (app == null || System.currentTimeMillis()-lastBlocked < 1500) return;
        long usage = prefs.flag(app+".limit",false) ? UsageAccess.today(this,foreground) : 0;
        if (prefs.blocked(app,usage) && performGlobalAction(GLOBAL_ACTION_HOME)) {
            lastBlocked = System.currentTimeMillis(); foreground = "";
            Toast.makeText(this,"Blocked by TentBlocker. Open the distraction-free version in TentBlocker.",Toast.LENGTH_LONG).show();
        }
    }
    @Override public void onInterrupt() { foreground=""; }
    @Override public void onDestroy() { handler.removeCallbacksAndMessages(null); super.onDestroy(); }
}
