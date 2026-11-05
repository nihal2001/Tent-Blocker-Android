package com.nihal.tentblocker;
import android.app.AppOpsManager;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import java.time.ZonedDateTime;

final class UsageAccess {
    static boolean allowed(Context c) {
        AppOpsManager ops = (AppOpsManager)c.getSystemService(Context.APP_OPS_SERVICE);
        return ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, android.os.Process.myUid(),c.getPackageName()) == AppOpsManager.MODE_ALLOWED;
    }
    static long today(Context c, String pkg) {
        if (!allowed(c)) return 0;
        long now = System.currentTimeMillis();
        long midnight = ZonedDateTime.now().toLocalDate().atStartOfDay(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli();
        UsageStatsManager manager = (UsageStatsManager)c.getSystemService(Context.USAGE_STATS_SERVICE);
        UsageEvents events = manager.queryEvents(midnight - 86400000L,now);
        if (events == null) return 0;
        UsageEvents.Event event = new UsageEvents.Event();
        long started = -1, total = 0;
        while (events.hasNextEvent()) {
            events.getNextEvent(event);
            int type = event.getEventType();
            if (type == UsageEvents.Event.ACTIVITY_RESUMED) {
                if (pkg.equals(event.getPackageName())) { if (started < 0) started = Math.max(midnight,event.getTimeStamp()); }
                else if (started >= 0) { total += Math.max(0,event.getTimeStamp()-started); started=-1; }
            } else if ((pkg.equals(event.getPackageName()) && type == UsageEvents.Event.ACTIVITY_PAUSED)
                    || type == UsageEvents.Event.SCREEN_NON_INTERACTIVE || type == UsageEvents.Event.DEVICE_SHUTDOWN) {
                if (started >= 0) { total += Math.max(0,event.getTimeStamp()-started); started=-1; }
            }
        }
        if (started >= 0) total += now-started;
        return total;
    }
}
