# Device acceptance checklist

Build checks do not substitute for live website and accessibility testing. Use a physical Android phone with current System WebView; no signed-in social accounts are available in automated tests.

- Open both wrappers. Sign in and restart the app; verify cookies persist.
- Instagram: visit all tabs, open a message/story/comment sheet, go Back, and verify the native bar hides when necessary. Confirm Profile resolves to the signed-in profile and DM count updates.
- Switch between wrappers through Home and verify each retains its place; audio should pause when leaving a wrapper.
- Hide tabs, try hiding the final one, and toggle Discover. Search results should remain available.
- Follow a Reels feed link and a direct reel link. The feed should redirect; a single reel should remain accessible.
- Toggle each YouTube feed preference. Check home, subscriptions, watch-page recommendations, channel Shorts, and a direct Shorts link.
- Test fullscreen video, rotation, picker upload, external HTTPS links, Back, and airplane-mode refresh.
- Enable Accessibility, set Always block for one app, and open that original app. Verify it returns Home while the wrapper and other app stay usable.
- Test a timer expiring while another rule remains active; that other rule must still block.
- Test a scheduled interval starting while the original app is open, overnight boundaries, and an excluded weekday.
- Grant Usage access, set a small daily limit, and verify existing usage counts. Keep the original app open until the threshold; check midnight reset.
- Revoke each permission, reconnect accessibility, reboot, and verify status/rules. Test screen off/on and notification shade or keyboard transitions while a target app is foregrounded.
- Check small-screen layouts, large font sizes, TalkBack labels, gesture navigation, and three-button navigation.
