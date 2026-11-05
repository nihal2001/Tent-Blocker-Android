package com.nihal.tentblocker;
import java.time.ZonedDateTime;
import java.util.Set;

/** Pure rule evaluation. Weekdays use ISO numbering: Monday=1, Sunday=7. */
public final class BlockRules {
    private BlockRules() {}
    public static boolean scheduled(ZonedDateTime now, int start, int end, Set<Integer> days) {
        int minute = now.getHour() * 60 + now.getMinute();
        int today = now.getDayOfWeek().getValue();
        if (start == end) return false;
        if (start < end) return days.contains(today) && minute >= start && minute < end;
        int yesterday = today == 1 ? 7 : today - 1;
        return (days.contains(today) && minute >= start) || (days.contains(yesterday) && minute < end);
    }
    public static boolean blocked(boolean always, long timerEnd, long now, boolean schedule, boolean limit, long used, int minutes) {
        return always || timerEnd > now || schedule || (limit && used >= minutes * 60_000L);
    }
}
