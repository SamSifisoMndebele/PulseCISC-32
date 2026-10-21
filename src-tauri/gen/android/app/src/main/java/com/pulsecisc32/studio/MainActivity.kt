package com.pulsecisc32.studio

import android.content.res.Configuration
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

class MainActivity : TauriActivity() {

    private var currentWebView: WebView? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val isDark = isSystemDarkMode()
        applySystemBarsTheme(isDark)
    }

    override fun onResume() {
        super.onResume()
        applySystemBarsTheme(isSystemDarkMode())
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        val isDark = (newConfig.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
        applySystemBarsTheme(isDark)
    }

    override fun onWebViewCreate(webView: WebView) {
        super.onWebViewCreate(webView)
        currentWebView = webView

        // Register JavascriptInterface for dynamic theme sync from React UI
        webView.addJavascriptInterface(object {
            @JavascriptInterface
            fun setSystemBarsTheme(isDark: Boolean) {
                runOnUiThread {
                    applySystemBarsTheme(isDark)
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
        val darkStatusColor = Color.parseColor("#0D121D")
        val lightStatusColor = Color.parseColor("#FFFFFF")
        val darkNavColor = Color.parseColor("#0B101B")
        val lightNavColor = Color.parseColor("#FFFFFF")

        val statusColor = if (isDark) darkStatusColor else lightStatusColor
        val navColor = if (isDark) darkNavColor else lightNavColor

        val statusBarStyle = if (isDark) {
            SystemBarStyle.dark(statusColor)
        } else {
            SystemBarStyle.light(statusColor, statusColor)
        }

        val navBarStyle = if (isDark) {
            SystemBarStyle.dark(navColor)
        } else {
            SystemBarStyle.light(navColor, navColor)
        }

        enableEdgeToEdge(
            statusBarStyle = statusBarStyle,
            navigationBarStyle = navBarStyle
        )

        // Explicitly set status and navigation bar icon contrast
        val insetsController = WindowInsetsControllerCompat(window, window.decorView)
        // isAppearanceLightStatusBars: true = dark icons (on light status bar), false = white icons (on dark status bar)
        insetsController.isAppearanceLightStatusBars = !isDark
        insetsController.isAppearanceLightNavigationBars = !isDark

        // Prevent Android from forcing unwanted light/gray contrast scrims on the navigation bar
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.isStatusBarContrastEnforced = false
            window.isNavigationBarContrastEnforced = false
        }

        window.statusBarColor = statusColor
        window.navigationBarColor = navColor
    }
}
