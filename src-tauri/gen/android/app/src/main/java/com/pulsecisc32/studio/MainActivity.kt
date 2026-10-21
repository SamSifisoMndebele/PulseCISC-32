package com.pulsecisc32.studio

import android.content.res.Configuration
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowInsetsController
import android.view.WindowManager
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

    private var topInsetDp: Int = 0
    private var bottomInsetDp: Int = 0
    private var leftInsetDp: Int = 0
    private var rightInsetDp: Int = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        // Initialize AndroidX Core SplashScreen and hold splash screen until React is rendered and ready
        val splashScreen = installSplashScreen()
        splashScreen.setKeepOnScreenCondition { !isAppReady }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val params = window.attributes
            params.layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
            window.attributes = params
        }

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
        injectInsets()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            applySystemBarsTheme(currentIsDark)
            injectInsets()
        }
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        val isDark = (newConfig.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
        currentIsDark = isDark
        applySystemBarsTheme(isDark)
        window.decorView.postDelayed({ injectInsets() }, 50)
    }

    private fun getFallbackStatusBarHeight(): Int {
        var result = 0
        val resourceId = resources.getIdentifier("status_bar_height", "dimen", "android")
        if (resourceId > 0) {
            result = resources.getDimensionPixelSize(resourceId)
        }
        val density = resources.displayMetrics.density
        return if (density > 0f) (result / density).toInt() else 24
    }

    private fun getFallbackNavigationBarHeight(): Int {
        var result = 0
        val resourceId = resources.getIdentifier("navigation_bar_height", "dimen", "android")
        if (resourceId > 0) {
            result = resources.getDimensionPixelSize(resourceId)
        }
        val density = resources.displayMetrics.density
        return if (density > 0f) (result / density).toInt() else 16
    }

    private fun updateInsets(insets: WindowInsetsCompat? = null) {
        val density = resources.displayMetrics.density
        val rootInsets = insets ?: ViewCompat.getRootWindowInsets(window.decorView)
        val bars = rootInsets?.getInsets(
            WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
        )

        var top = if (bars != null && bars.top > 0) (bars.top / density).toInt() else 0
        var bottom = if (bars != null && bars.bottom > 0) (bars.bottom / density).toInt() else 0
        val left = if (bars != null && bars.left > 0) (bars.left / density).toInt() else 0
        val right = if (bars != null && bars.right > 0) (bars.right / density).toInt() else 0

        // If systemBars reported 0 (e.g. before initial layout pass), use system dimen fallbacks
        if (top == 0) {
            top = getFallbackStatusBarHeight()
        }
        if (bottom == 0) {
            bottom = getFallbackNavigationBarHeight()
        }

        topInsetDp = top
        bottomInsetDp = bottom
        leftInsetDp = left
        rightInsetDp = right
    }

    fun injectInsets() {
        val webView = currentWebView ?: return
        updateInsets()
        val js = """
            (function() {
                var s = document.documentElement.style;
                s.setProperty('--sat', '${topInsetDp}px');
                s.setProperty('--sab', '${bottomInsetDp}px');
                s.setProperty('--sal', '${leftInsetDp}px');
                s.setProperty('--sar', '${rightInsetDp}px');
            })();
        """.trimIndent()
        runOnUiThread {
            webView.evaluateJavascript(js, null)
        }
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

        // Register JavascriptInterface for dynamic theme sync, splash dismissal & insets from React UI
        webView.addJavascriptInterface(object {
            @JavascriptInterface
            fun setSystemBarsTheme(isDark: Boolean) {
                runOnUiThread {
                    applySystemBarsTheme(isDark)
                    injectInsets()
                }
            }

            @JavascriptInterface
            fun markAppReady() {
                runOnUiThread {
                    isAppReady = true
                    injectInsets()
                }
            }

            @JavascriptInterface
            fun syncInsets() {
                runOnUiThread {
                    injectInsets()
                }
            }

            @JavascriptInterface
            fun getInsets(): String {
                updateInsets()
                return """{"top":$topInsetDp,"bottom":$bottomInsetDp,"left":$leftInsetDp,"right":$rightInsetDp}"""
            }
        }, "AndroidBridge")

        // Propagate system bar insets to CSS variables (--sat, --sab, etc.)
        ViewCompat.setOnApplyWindowInsetsListener(webView) { _, insets ->
            updateInsets(insets)
            injectInsets()
            insets
        }
        ViewCompat.requestApplyInsets(webView)

        // Post staggered injections to guarantee insets are present once page DOM parses
        val delays = longArrayOf(50, 150, 300, 600, 1200, 2000)
        for (d in delays) {
            window.decorView.postDelayed({ injectInsets() }, d)
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
