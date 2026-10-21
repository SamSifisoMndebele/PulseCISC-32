package com.pulsecisc32.studio

import android.content.res.Configuration
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowInsetsController
import android.webkit.JavascriptInterface
import android.webkit.WebSettings
import android.webkit.WebView
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : TauriActivity() {

    private var currentWebView: WebView? = null
    private var currentIsDark: Boolean = true
    @Volatile
    private var isAppReady: Boolean = false

    override fun onCreate(savedInstanceState: Bundle?) {
        // Initialize AndroidX Core SplashScreen and hold splash screen until React is rendered and ready
        val splashScreen = installSplashScreen()
        splashScreen.setKeepOnScreenCondition { !isAppReady }

        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.auto(Color.TRANSPARENT, Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.auto(Color.TRANSPARENT, Color.TRANSPARENT)
        )
        super.onCreate(savedInstanceState)
        currentIsDark = isSystemDarkMode()
        applySystemBarsTheme(currentIsDark)

        // Safety fallback: if app takes unusually long (e.g. error), don't keep splashscreen indefinitely
        window.decorView.postDelayed({
            isAppReady = true
        }, 4000)
    }

    override fun onResume() {
        super.onResume()
        currentIsDark = isSystemDarkMode()
        applySystemBarsTheme(currentIsDark)
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            applySystemBarsTheme(currentIsDark)
        }
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        val isDark = (newConfig.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
        currentIsDark = isDark
        applySystemBarsTheme(isDark)
    }

    override fun onWebViewCreate(webView: WebView) {
        super.onWebViewCreate(webView)
        currentWebView = webView

        // Optimize WebView performance & eliminate blank white flash during launch
        webView.setBackgroundColor(Color.parseColor("#070A10"))
        webView.isVerticalScrollBarEnabled = false
        webView.isHorizontalScrollBarEnabled = false
        webView.overScrollMode = View.OVER_SCROLL_NEVER

        webView.settings.apply {
            cacheMode = WebSettings.LOAD_DEFAULT
            domStorageEnabled = true
            databaseEnabled = true
            // Allow fast rendering pipeline
            @Suppress("DEPRECATION")
            setRenderPriority(WebSettings.RenderPriority.HIGH)
        }

        applySystemBarsTheme(currentIsDark)

        // Register JavascriptInterface for dynamic theme sync & splash dismissal from React UI
        webView.addJavascriptInterface(object {
            @JavascriptInterface
            fun setSystemBarsTheme(isDark: Boolean) {
                runOnUiThread {
                    applySystemBarsTheme(isDark)
                }
            }

            @JavascriptInterface
            fun markAppReady() {
                runOnUiThread {
                    isAppReady = true
                }
            }
        }, "AndroidBridge")

        // Propagate system bar insets to CSS variables (--sat, --sab, etc.)
        ViewCompat.setOnApplyWindowInsetsListener(webView) { _, insets ->
            val bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
            )
            val density = resources.displayMetrics.density
            val topDp = (bars.top / density).toInt()
            val bottomDp = (bars.bottom / density).toInt()
            val leftDp = (bars.left / density).toInt()
            val rightDp = (bars.right / density).toInt()

            val js = """
                (function() {
                    document.documentElement.style.setProperty('--sat', '${topDp}px');
                    document.documentElement.style.setProperty('--sab', '${bottomDp}px');
                    document.documentElement.style.setProperty('--sal', '${leftDp}px');
                    document.documentElement.style.setProperty('--sar', '${rightDp}px');
                })();
            """.trimIndent()
            webView.evaluateJavascript(js, null)
            insets
        }
    }

    private fun isSystemDarkMode(): Boolean {
        return (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
    }

    fun applySystemBarsTheme(isDark: Boolean) {
        currentIsDark = isDark
        // lightBars: true means background is light -> render DARK text/icons
        // lightBars: false means background is dark -> render LIGHT/WHITE text/icons
        val lightBars = !isDark

        val task = Runnable {
            // 1. AndroidX WindowCompat
            WindowCompat.getInsetsController(window, window.decorView).apply {
                isAppearanceLightStatusBars = lightBars
                isAppearanceLightNavigationBars = lightBars
            }

            // 2. Android 11+ (API 30+) direct WindowInsetsController API
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                val statusFlag = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                val navFlag = WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS
                val mask = statusFlag or navFlag
                window.insetsController?.setSystemBarsAppearance(
                    if (lightBars) mask else 0,
                    mask
                )
            }

            // 3. Android 6.0 to 10 (API 23-29) & OEM skins (MIUI/HyperOS/ColorOS) fallback via systemUiVisibility
            @Suppress("DEPRECATION")
            var flags = window.decorView.systemUiVisibility
            flags = if (lightBars) {
                flags or View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
            } else {
                flags and View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR.inv()
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                flags = if (lightBars) {
                    flags or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
                } else {
                    flags and View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR.inv()
                }
            }
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = flags

            // 4. Disable contrast enforcement on API 29+ to prevent gray scrims
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                window.isStatusBarContrastEnforced = false
                window.isNavigationBarContrastEnforced = false
            }

            // 5. Ensure status bar is transparent so app background shines through
            @Suppress("DEPRECATION")
            window.statusBarColor = Color.TRANSPARENT
            @Suppress("DEPRECATION")
            window.navigationBarColor = if (isDark) Color.parseColor("#0B101B") else Color.parseColor("#FFFFFF")
        }

        runOnUiThread(task)
        window.decorView.post(task)
    }
}
