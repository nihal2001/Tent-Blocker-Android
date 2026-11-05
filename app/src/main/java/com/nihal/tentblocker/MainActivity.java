package com.nihal.tentblocker;

import android.app.*;
import android.content.*;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Settings;
import android.view.*;
import android.view.accessibility.AccessibilityManager;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.webkit.*;
import android.widget.*;
import androidx.webkit.*;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;
import java.util.*;

public final class MainActivity extends Activity {
    private static final int INK=0xff172b24, GREEN=0xff245c4a, PAPER=0xfffafaf7, MUTED=0xff66736c;
    private Preferences prefs;
    private LinearLayout root, navigation;
    private FrameLayout webContainer;
    private final Map<String,WebView> browsers=new LinkedHashMap<>();
    private final Map<WebView,ScriptHandler> scripts=new HashMap<>();
    private final Map<WebView,String> paths=new HashMap<>();
    private final Map<WebView,Boolean> overlays=new HashMap<>();
    private WebView current;
    private String screen="home", selected="", profilePath;
    private int unread;
    private String settingsApp;
    private ValueCallback<Uri[]> upload;
    private View fullscreen;
    private WebChromeClient.CustomViewCallback fullscreenCallback;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        prefs=new Preferences(this);
        CookieManager.getInstance().setAcceptCookie(true);
        showHome();
    }
    private int dp(int value) { return Math.round(value*getResources().getDisplayMetrics().density); }
    private LinearLayout column() { LinearLayout v=new LinearLayout(this); v.setOrientation(LinearLayout.VERTICAL); return v; }
    private LinearLayout row() { LinearLayout v=new LinearLayout(this); v.setGravity(Gravity.CENTER_VERTICAL); return v; }
    private TextView text(String title,int size,int color) {
        TextView v=new TextView(this); v.setText(title); v.setTextSize(size); v.setTextColor(color); v.setPadding(0,dp(8),0,dp(8)); return v;
    }
    private GradientDrawable rounded(int color) { GradientDrawable d=new GradientDrawable(); d.setColor(color); d.setCornerRadius(dp(20)); return d; }
    private Button button(String label,Runnable action) {
        Button b=new Button(this); b.setText(label); b.setAllCaps(false); b.setTextColor(GREEN); b.setMinHeight(dp(48)); b.setOnClickListener(v->action.run()); return b;
    }
    private void base(String name) {
        if (current!=null) current.onPause();
        screen=name;
        root=column(); root.setBackgroundColor(PAPER);
        root.setOnApplyWindowInsetsListener((v,insets)->{
            v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom()); return insets;
        });
        setContentView(root); root.requestApplyInsets();
    }
    private LinearLayout page(String title,Runnable back) {
        base("settings");
        LinearLayout bar=row(); bar.setPadding(dp(12),0,dp(16),0);
        bar.addView(button("‹ Back",back)); TextView h=text(title,23,INK); h.setTypeface(null,Typeface.BOLD); bar.addView(h); root.addView(bar);
        ScrollView scroll=new ScrollView(this); LinearLayout content=column(); content.setPadding(dp(24),dp(8),dp(24),dp(32)); scroll.addView(content); root.addView(scroll); return content;
    }
    private void section(LinearLayout content,String title) { TextView h=text(title,18,INK); h.setTypeface(null,Typeface.BOLD); h.setPadding(0,dp(24),0,dp(8)); content.addView(h); }
    private void note(LinearLayout content,String value) { content.addView(text(value,14,MUTED)); }
    private void showHome() {
        base("home");
        LinearLayout content=column(); content.setPadding(dp(24),dp(28),dp(24),0); root.addView(content);
        LinearLayout header=row(); TextView title=text("TentBlocker",32,INK); title.setTypeface(null,Typeface.BOLD);
        header.addView(title,new LinearLayout.LayoutParams(0,-2,1)); header.addView(button("Settings",this::showSettings)); content.addView(header);
        note(content,"Your apps, without the rabbit holes.");
        LinearLayout apps=row(); apps.setPadding(0,dp(30),0,0); content.addView(apps);
        addApp(apps,"Instagram","◎",new int[]{0xfffacb4a,0xffec493d,0xffcf2987,0xff7338cc},()->openBrowser("instagram.home"));
        addApp(apps,"YouTube","▶",new int[]{0xffcc0000,0xffff3333},()->openBrowser("youtube"));
    }
    private void addApp(LinearLayout parent,String name,String symbol,int[] colors,Runnable action) {
        LinearLayout tile=column(); tile.setGravity(Gravity.CENTER); tile.setPadding(0,0,dp(24),0);
        TextView icon=text(symbol,34,Color.WHITE); icon.setGravity(Gravity.CENTER); icon.setPadding(0,0,0,0);
        GradientDrawable background=new GradientDrawable(GradientDrawable.Orientation.BL_TR,colors); background.setCornerRadius(dp(17)); icon.setBackground(background);
        tile.addView(icon,new LinearLayout.LayoutParams(dp(72),dp(72))); TextView label=text(name,13,INK); tile.addView(label);
        tile.setContentDescription(name); tile.setFocusable(true); tile.setOnClickListener(v->action.run()); parent.addView(tile);
    }
    private void showSettings() {
        LinearLayout c=page("Settings",this::showHome);
        section(c,"Apps"); c.addView(button("Instagram  ›",()->appSettings("instagram"))); c.addView(button("YouTube  ›",()->appSettings("youtube")));
        section(c,"App blocking access");
        note(c,"Accessibility: "+(blockerEnabled()?"enabled":"not enabled")+"\nUsage access: "+(UsageAccess.allowed(this)?"enabled":"not enabled"));
        note(c,"Blocking returns you to Android Home when a rule applies to the original Instagram or YouTube app. The wrappers remain available.");
        c.addView(button("Enable app blocking",()->new AlertDialog.Builder(this).setTitle("Allow app blocking?")
            .setMessage(getString(R.string.blocker_description)).setNegativeButton("Cancel",null)
            .setPositiveButton("Open Accessibility settings",(d,w)->startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))).show()));
        c.addView(button("Allow usage access for daily limits",()->startActivity(new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS))));
        note(c,"Permissions are optional. Feed filters work without them. Blocking can be bypassed by disabling accessibility or uninstalling the app.");
    }
    private boolean blockerEnabled() {
        AccessibilityManager manager=(AccessibilityManager)getSystemService(ACCESSIBILITY_SERVICE);
        for (AccessibilityServiceInfo info:manager.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK)) {
            if (getPackageName().equals(info.getResolveInfo().serviceInfo.packageName)) return true;
        }
        return false;
    }
    private void toggle(LinearLayout c,String label,String key,boolean defaultValue) {
        Switch s=new Switch(this); s.setText(label); s.setTextSize(16); s.setTextColor(INK); s.setPadding(0,dp(14),0,dp(14)); s.setMinHeight(dp(52)); s.setChecked(prefs.flag(key,defaultValue)); c.addView(s);
        s.setOnCheckedChangeListener((b,on)->{
            if (key.startsWith("instagram.tab.")&&!on) {
                int count=0; for (String tab:new String[]{"home","messages","search","profile"}) if (prefs.flag("instagram.tab."+tab,true)) count++;
                if (count==1) { s.setChecked(true); Toast.makeText(this,"Keep at least one tab visible",Toast.LENGTH_SHORT).show(); return; }
            }
            prefs.setFlag(key,on); updateScripts();
        });
    }
    private void appSettings(String app) {
        LinearLayout c=page(app.equals("instagram")?"Instagram":"YouTube",this::showSettings);
        screen="appSettings"; settingsApp=app;
        section(c,app.equals("instagram")?"Visible tabs":"Your feed");
        if(app.equals("instagram")) {
            for(String tab:new String[]{"home","messages","search","profile"}) toggle(c,capitalize(tab),"instagram.tab."+tab,true);
            section(c,"Discover"); toggle(c,"Show suggested posts in Search","instagram.discover",false); note(c,"Reels feeds are removed. Direct links to individual reels still work.");
        } else {
            toggle(c,"Show Shorts","youtube.shorts",false); toggle(c,"Show subscriptions","youtube.subscriptions",true); toggle(c,"Show recommended videos","youtube.recommendations",true);
        }
        section(c,"Block the original app");
        note(c,blockerEnabled()?"App blocking is enabled.":"Enable app blocking in Settings to enforce these rules.");
        toggle(c,"Always block",app+".always",false);
        long end=prefs.data.getLong(app+".timer",0);
        if(end>System.currentTimeMillis()) note(c,"Timed block ends "+java.text.DateFormat.getDateTimeInstance(java.text.DateFormat.SHORT,java.text.DateFormat.SHORT).format(new Date(end)));
        c.addView(button("Block for a while…",()->{
            int[] minutes={15,30,60,120,240,480}; String[] labels={"15 minutes","30 minutes","1 hour","2 hours","4 hours","8 hours"};
            new AlertDialog.Builder(this).setTitle("Block for").setItems(labels,(d,i)->{prefs.data.edit().putLong(app+".timer",System.currentTimeMillis()+minutes[i]*60000L).apply();appSettings(app);}).show();
        }));
        if(end>System.currentTimeMillis()) c.addView(button("End timed block",()->{prefs.data.edit().remove(app+".timer").apply();appSettings(app);}));
        section(c,"Weekly schedule"); toggle(c,"Use schedule",app+".schedule",false);
        c.addView(button("From "+time(prefs.number(app+".start",1320)),()->pickTime(app,"start",1320)));
        c.addView(button("Until "+time(prefs.number(app+".end",420)),()->pickTime(app,"end",420)));
        c.addView(button("Choose days…",()->{
            String[] names={"Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"}; boolean[] values=new boolean[7];
            for(int i=0;i<7;i++) values[i]=prefs.flag(app+".day"+(i+1),true);
            new AlertDialog.Builder(this).setTitle("Days the block starts").setMultiChoiceItems(names,values,(d,i,on)->values[i]=on)
                .setNegativeButton("Cancel",null).setPositiveButton("Save",(d,w)->{for(int i=0;i<7;i++) prefs.setFlag(app+".day"+(i+1),values[i]);appSettings(app);}).show();
        }));
        note(c,"An overnight schedule ends the following morning. Equal start and end times disable the schedule.");
        section(c,"Daily limit"); toggle(c,"Limit daily usage",app+".limit",false);
        c.addView(button(prefs.number(app+".minutes",30)+" minutes per day",()->{
            int[] choices={5,10,15,20,30,45,60,90,120}; String[] labels=Arrays.stream(choices).mapToObj(i->i+" minutes").toArray(String[]::new);
            new AlertDialog.Builder(this).setTitle("Daily allowance").setItems(labels,(d,i)->{prefs.setNumber(app+".minutes",choices[i]);appSettings(app);}).show();
        }));
        note(c,UsageAccess.allowed(this)?"Counts original-app usage today, resetting at local midnight.":"Usage access is required for daily limits. Enable it in Settings.");
    }
    private String capitalize(String s) { return Character.toUpperCase(s.charAt(0))+s.substring(1); }
    private String time(int minutes) { return String.format(Locale.getDefault(),"%02d:%02d",minutes/60,minutes%60); }
    private void pickTime(String app,String key,int fallback) {
        int value=prefs.number(app+"."+key,fallback);
        new TimePickerDialog(this,(v,h,m)->{prefs.setNumber(app+"."+key,h*60+m);appSettings(app);},value/60,value%60,android.text.format.DateFormat.is24HourFormat(this)).show();
    }
    private String rootUrl(String key) {
        return switch(key) {
            case "youtube" -> "https://m.youtube.com/";
            case "instagram.messages" -> "https://www.instagram.com/direct/inbox/";
            case "instagram.search" -> "https://www.instagram.com/explore/";
            case "instagram.profile" -> "https://www.instagram.com"+(profilePath==null?"/accounts/edit/":profilePath);
            default -> "https://www.instagram.com/";
        };
    }
    private void openBrowser(String key) {
        if(key.startsWith("instagram.")&&!prefs.flag("instagram.tab."+key.substring(10),true)) {
            for(String tab:new String[]{"home","messages","search","profile"}) if(prefs.flag("instagram.tab."+tab,true)) { key="instagram."+tab; break; }
        }
        base("browser"); selected=key;
        LinearLayout toolbar=row(); toolbar.addView(button("⌂ Home",this::showHome));
        TextView title=text(key.equals("youtube")?"YouTube":"Instagram",18,INK); toolbar.addView(title,new LinearLayout.LayoutParams(0,-2,1));
        toolbar.addView(button("↻",()->current.reload())); toolbar.addView(button("⋮",()->appSettings(selected.equals("youtube")?"youtube":"instagram"))); root.addView(toolbar);
        webContainer=new FrameLayout(this); root.addView(webContainer,new LinearLayout.LayoutParams(-1,0,1));
        navigation=row(); root.addView(navigation);
        current=browsers.get(key);
        if(current==null) { current=createBrowser(key); browsers.put(key,current); current.loadUrl(rootUrl(key)); }
        if(current.getParent()!=null) ((android.view.ViewGroup)current.getParent()).removeView(current);
        webContainer.addView(current,new FrameLayout.LayoutParams(-1,-1)); current.onResume(); updateNavigation();
    }
    private String asset(String name) {
        try(java.io.InputStream in=getAssets().open(name)) { java.io.ByteArrayOutputStream out=new java.io.ByteArrayOutputStream(); byte[] buffer=new byte[8192]; int n; while((n=in.read(buffer))!=-1)out.write(buffer,0,n); return out.toString(StandardCharsets.UTF_8.name()); }
        catch(java.io.IOException e) { throw new IllegalStateException("Missing bundled filter "+name,e); }
    }
    private boolean trusted(Uri uri,boolean youtube) {
        String host=uri.getHost(); if(host==null||!"https".equals(uri.getScheme())) return false;
        String[] domains=youtube?new String[]{"youtube.com","youtu.be","accounts.google.com"}:new String[]{"instagram.com","facebook.com"};
        for(String d:domains) if(host.equals(d)||host.endsWith("."+d)) return true; return false;
    }
    private String script(boolean youtube) {
        return youtube?"window.__tbYT="+prefs.youtubeJson()+";\n"+asset("youtube.js"):
            asset("reel-guard.js")+"\n"+asset("instagram.js")+"\nif(document.documentElement)document.documentElement.classList.toggle('tb-no-discover',"+!prefs.flag("instagram.discover",false)+");";
    }
    private void installScript(WebView web,boolean youtube) {
        if(WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            ScriptHandler old=scripts.remove(web); if(old!=null)old.remove();
            scripts.put(web,WebViewCompat.addDocumentStartJavaScript(web,script(youtube),Collections.singleton(youtube?"https://*.youtube.com":"https://*.instagram.com")));
        }
    }
    private void updateScripts() {
        for(Map.Entry<String,WebView> entry:browsers.entrySet()) {
            boolean yt=entry.getKey().equals("youtube"); WebView web=entry.getValue(); installScript(web,yt);
            if(web.getUrl()!=null&&trusted(Uri.parse(web.getUrl()),yt)) web.evaluateJavascript(yt?"window.__tbYTApply?.("+prefs.youtubeJson()+")":"document.documentElement.classList.toggle('tb-no-discover',"+!prefs.flag("instagram.discover",false)+")",null);
        }
    }
    @android.annotation.SuppressLint("SetJavaScriptEnabled")
    private WebView createBrowser(String key) {
        boolean youtube=key.equals("youtube"); WebView web=new WebView(this); web.setBackgroundColor(PAPER);
        WebSettings config=web.getSettings(); config.setJavaScriptEnabled(true); config.setDomStorageEnabled(true);
        config.setAllowFileAccess(false); config.setAllowContentAccess(false); config.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        config.setMediaPlaybackRequiresUserGesture(false); CookieManager.getInstance().setAcceptThirdPartyCookies(web,true);
        if(!youtube&&WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(web,"tentBlocker",Collections.singleton("https://*.instagram.com"),(view,message,origin,mainFrame,reply)->{
                if(!mainFrame)return;
                try {
                    JSONObject data=new JSONObject(message.getData());
                    switch(data.optString("kind")) {
                        case "path": paths.put(web,data.optString("path")); applyInstagramState(web); break;
                        case "overlay": overlays.put(web,data.optBoolean("open")); break;
                        case "nav": String p=data.optString("profilePath"); if(p.startsWith("/")&&!p.startsWith("//"))profilePath=p; unread=data.optInt("unread"); break;
                    }
                    if(current==web&&screen.equals("browser"))updateNavigation();
                } catch(org.json.JSONException ignored) { }
            });
        }
        installScript(web,youtube);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request) {
                if(!request.isForMainFrame())return false;
                Uri uri=request.getUrl();
                if(!trusted(uri,youtube)) {
                    if("https".equals(uri.getScheme())&&!"play.google.com".equals(uri.getHost())) {
                        try { startActivity(new Intent(Intent.ACTION_VIEW,uri)); } catch(ActivityNotFoundException ignored) { Toast.makeText(MainActivity.this,"No browser available",Toast.LENGTH_SHORT).show(); }
                    }
                    return true;
                }
                return false;
            }
            @Override public void onPageFinished(WebView view,String url) {
                if(trusted(Uri.parse(url),youtube)) { view.evaluateJavascript(script(youtube),null); if(!youtube) {paths.put(web,Uri.parse(url).getPath());applyInstagramState(web);} }
                CookieManager.getInstance().flush(); if(current==web&&screen.equals("browser"))updateNavigation();
            }
            @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError error) {
                if(request.isForMainFrame()) Toast.makeText(MainActivity.this,"Could not load page. Check your connection and tap refresh.",Toast.LENGTH_LONG).show();
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params) {
                if(upload!=null)upload.onReceiveValue(null); upload=callback;
                try { startActivityForResult(params.createIntent(),41); } catch(ActivityNotFoundException e) { upload.onReceiveValue(null);upload=null;return false; } return true;
            }
            @Override public void onShowCustomView(View view,CustomViewCallback callback) {
                if(fullscreen!=null) {callback.onCustomViewHidden();return;} fullscreen=view;fullscreenCallback=callback;
                ((ViewGroup)getWindow().getDecorView()).addView(view,new ViewGroup.LayoutParams(-1,-1));
            }
            @Override public void onHideCustomView() { exitFullscreen(); }
        });
        return web;
    }
    private void applyInstagramState(WebView web) {
        String p=paths.getOrDefault(web,"/"); boolean full=isFullScreen(p);
        web.evaluateJavascript("document.documentElement.classList.toggle('tb-full-screen',"+full+");document.documentElement.classList.toggle('tb-no-discover',"+!prefs.flag("instagram.discover",false)+")",null);
    }
    private boolean isFullScreen(String p) {
        return p.startsWith("/stories/")||p.startsWith("/direct/t/")||p.startsWith("/direct/new")||p.startsWith("/accounts/")||p.startsWith("/create/")||p.endsWith("/comments/");
    }
    private void updateNavigation() {
        if(navigation==null)return; navigation.removeAllViews();
        if(selected.equals("youtube")) {navigation.setVisibility(View.GONE);return;}
        String cookie=CookieManager.getInstance().getCookie("https://www.instagram.com");
        boolean signedIn=cookie!=null&&Arrays.stream(cookie.split(";")).anyMatch(s->s.trim().startsWith("sessionid=")&&s.trim().length()>10);
        int count=0;
        for(String tab:new String[]{"home","messages","search","profile"}) if(prefs.flag("instagram.tab."+tab,true)) {
            count++; String key="instagram."+tab;
            Button b=button(capitalize(tab)+(tab.equals("messages")&&unread>0?" ("+unread+")":""),()->{
                if(selected.equals(key)) {if(current.getScrollY()>dp(8))current.scrollTo(0,0);else current.loadUrl(rootUrl(key));} else openBrowser(key);
            });
            b.setTextSize(11); if(selected.equals(key))b.setTypeface(null,Typeface.BOLD); navigation.addView(b,new LinearLayout.LayoutParams(0,dp(56),1));
        }
        navigation.setVisibility(count>1&&signedIn&&!isFullScreen(paths.getOrDefault(current,"/"))&&!overlays.getOrDefault(current,false)?View.VISIBLE:View.GONE);
    }
    private void exitFullscreen() {
        if(fullscreen==null)return; ((ViewGroup)fullscreen.getParent()).removeView(fullscreen);fullscreen=null;
        if(fullscreenCallback!=null)fullscreenCallback.onCustomViewHidden();fullscreenCallback=null;
    }
    @Override protected void onActivityResult(int request,int result,Intent data) {
        super.onActivityResult(request,result,data); if(request==41&&upload!=null) {upload.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result,data));upload=null;}
    }
    @Override public void onBackPressed() {
        if(fullscreen!=null)exitFullscreen(); else if(screen.equals("browser")&&current!=null&&current.canGoBack())current.goBack();
        else if(!screen.equals("home"))showHome();else super.onBackPressed();
    }
    @Override protected void onPause() { if(current!=null)current.onPause();CookieManager.getInstance().flush();super.onPause(); }
    @Override protected void onResume() {super.onResume();if(screen.equals("settings"))showSettings();else if(screen.equals("appSettings"))appSettings(settingsApp);else if(current!=null&&screen.equals("browser"))current.onResume();}
    @Override protected void onDestroy() {
        if(upload!=null)upload.onReceiveValue(null);for(WebView web:browsers.values()) {if(web.getParent()!=null)((ViewGroup)web.getParent()).removeView(web);web.destroy();}super.onDestroy();
    }
}
