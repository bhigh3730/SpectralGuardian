# ProGuard rules for Spectral Matrix
# Add project-specific ProGuard rules here.

# Keep the WebView JS interface if you add one later
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Standard Android optimizations
-dontwarn android.webkit.**
-keep class android.webkit.** { *; }
