package com.nihal.tentblocker;
import org.junit.Test;
import static org.junit.Assert.*;
import java.time.ZonedDateTime;
import java.util.Set;
public class BlockRulesTest {
    private ZonedDateTime at(String date) { return ZonedDateTime.parse(date+"-06:00[America/Chicago]"); }
    @Test public void daytimeIncludesStartExcludesEnd() {
        assertTrue(BlockRules.scheduled(at("2026-11-09T09:00:00"),540,1020,Set.of(1)));
        assertFalse(BlockRules.scheduled(at("2026-11-09T17:00:00"),540,1020,Set.of(1)));
        assertFalse(BlockRules.scheduled(at("2026-11-10T10:00:00"),540,1020,Set.of(1)));
    }
    @Test public void overnightBelongsToStartingDay() {
        assertTrue(BlockRules.scheduled(at("2026-11-09T22:00:00"),1320,420,Set.of(1)));
        assertTrue(BlockRules.scheduled(at("2026-11-10T06:59:00"),1320,420,Set.of(1)));
        assertFalse(BlockRules.scheduled(at("2026-11-10T07:00:00"),1320,420,Set.of(1)));
        assertFalse(BlockRules.scheduled(at("2026-11-09T06:59:00"),1320,420,Set.of(1)));
    }
    @Test public void sundayWrapsIntoMonday() { assertTrue(BlockRules.scheduled(at("2026-11-09T01:00:00"),1320,420,Set.of(7))); }
    @Test public void emptyDaysAndZeroDurationDoNotBlock() {
        assertFalse(BlockRules.scheduled(at("2026-11-09T12:00:00"),540,1020,Set.of()));
        assertFalse(BlockRules.scheduled(at("2026-11-09T12:00:00"),540,540,Set.of(1)));
    }
    @Test public void timerExpiresExactlyAtDeadline() {
        assertTrue(BlockRules.blocked(false,100,99,false,false,0,30));
        assertFalse(BlockRules.blocked(false,100,100,false,false,0,30));
    }
    @Test public void rulesAreIndependent() {
        assertTrue(BlockRules.blocked(true,0,100,false,false,0,30));
        assertTrue(BlockRules.blocked(false,0,100,true,false,0,30));
        assertTrue(BlockRules.blocked(false,0,100,false,true,1800000,30));
        assertFalse(BlockRules.blocked(false,0,100,false,true,1799999,30));
        assertFalse(BlockRules.blocked(false,0,100,false,false,1800000,30));
    }
}
