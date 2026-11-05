package com.nihal.tentblocker;
import android.content.Context;
import android.content.SharedPreferences;
import java.time.ZonedDateTime;
import java.util.HashSet;
import java.util.Set;

final class Preferences {
    final SharedPreferences data;
    final Context context;
    Preferences(Context c) { context=c.getApplicationContext(); data = c.getSharedPreferences("tentblocker", Context.MODE_PRIVATE); }
    boolean flag(String key, boolean fallback) { return data.getBoolean(key, fallback); }
    int number(String key, int fallback) { return data.getInt(key, fallback); }
    void setFlag(String key, boolean value) { data.edit().putBoolean(key, value).apply(); }
    void setNumber(String key, int value) { data.edit().putInt(key, value).apply(); }
    Set<Integer> days(String app) {
        Set<Integer> result = new HashSet<>();
        for (int i=1;i<=7;i++) if (flag(app+".day"+i,true)) result.add(i);
        return result;
    }
    boolean blocked(String app, long usage) {
        ZonedDateTime now = ZonedDateTime.now();
        return BlockRules.blocked(flag(app+".always",false),data.getLong(app+".timer",0),System.currentTimeMillis(),
            flag(app+".schedule",false) && BlockRules.scheduled(now, number(app+".start",1320),number(app+".end",420),days(app)),
            flag(app+".limit",false) && UsageAccess.allowed(context), usage,number(app+".minutes",30));
    }
    String youtubeJson() { return "{\"showShorts\":"+flag("youtube.shorts",false)+",\"showSubscriptions\":"+flag("youtube.subscriptions",true)+",\"showRecommendations\":"+flag("youtube.recommendations",true)+"}"; }
}
