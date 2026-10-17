package ir.marsiro.nasab

import android.Manifest
import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.webkit.CookieManager
import android.webkit.GeolocationPermissions
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import java.io.File

/**
 * The installer app is the live site https://marsiro.ir/n inside a WebView, so every server deploy reaches
 * the phones without a new APK. The native side only adds what a browser tab would: the camera for
 * `<input type="file" capture>`, the location prompt, phone and map links, the back button and an offline screen.
 */
class MainActivity : ComponentActivity() {

    private lateinit var web: WebView
    private lateinit var offline: LinearLayout
    private lateinit var progress: ProgressBar

    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var cameraUri: Uri? = null
    private var pendingGeo: Pair<String, GeolocationPermissions.Callback>? = null

    private val takePicture = registerForActivityResult(ActivityResultContracts.TakePicture()) { ok ->
        val uri = cameraUri
        finishFileChooser(if (ok && uri != null) arrayOf(uri) else null)
    }

    private val pickFile = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        finishFileChooser(WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data))
    }

    private val locationPermission = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { grants ->
        val granted = grants.values.any { it }
        pendingGeo?.let { (origin, callback) -> callback.invoke(origin, granted, false) }
        pendingGeo = null
        if (!granted) Toast.makeText(this, R.string.location_denied, Toast.LENGTH_LONG).show()
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // Android 15 draws edge to edge: pad the content so the dark root shows behind the system bars.
        val root = findViewById<View>(R.id.root)
        WindowCompat.getInsetsController(window, root).apply {
            isAppearanceLightStatusBars = false
            isAppearanceLightNavigationBars = false
        }
        ViewCompat.setOnApplyWindowInsetsListener(root) { v, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime())
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            WindowInsetsCompat.CONSUMED
        }

        web = findViewById(R.id.web)
        offline = findViewById(R.id.offline)
        progress = findViewById(R.id.progress)
        findViewById<Button>(R.id.retry).setOnClickListener {
            offline.visibility = View.GONE
            web.reload()
        }

        CookieManager.getInstance().setAcceptCookie(true)
        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            setGeolocationEnabled(true)
            mediaPlaybackRequiresUserGesture = false
            cacheMode = WebSettings.LOAD_DEFAULT
            allowFileAccess = false
            allowContentAccess = true
            userAgentString = "$userAgentString MarsitoNasab/${BuildConfig.VERSION_NAME} (Android)"
        }
        web.webViewClient = Client()
        web.webChromeClient = Chrome()

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (web.canGoBack()) web.goBack() else finish()
            }
        })

        if (savedInstanceState == null || web.restoreState(savedInstanceState) == null) web.loadUrl(START_URL)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    override fun onPause() {
        super.onPause()
        CookieManager.getInstance().flush() // keep the login across app restarts
    }

    override fun onDestroy() {
        finishFileChooser(null)
        web.destroy()
        super.onDestroy()
    }

    private fun finishFileChooser(uris: Array<Uri>?) {
        fileCallback?.onReceiveValue(uris)
        fileCallback = null
        cameraUri = null
    }

    private fun openExternally(uri: Uri) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        } catch (e: ActivityNotFoundException) {
            Toast.makeText(this, R.string.no_app, Toast.LENGTH_SHORT).show()
        }
    }

    private fun isAppUrl(uri: Uri): Boolean {
        val path = uri.path ?: ""
        return uri.scheme == "https" && uri.host == HOST &&
            (path == "/n" || path.startsWith("/n/") || path.startsWith("/api/") || path.startsWith("/nasab"))
    }

    private inner class Client : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            val uri = request.url
            if (isAppUrl(uri)) return false
            // tel:, Neshan maps, the warehouse app and anything else open outside the installer app.
            openExternally(uri)
            return true
        }

        override fun onPageFinished(view: WebView, url: String?) {
            CookieManager.getInstance().flush()
        }

        override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
            if (request.isForMainFrame) offline.visibility = View.VISIBLE
        }
    }

    private inner class Chrome : WebChromeClient() {
        override fun onProgressChanged(view: WebView, newProgress: Int) {
            progress.progress = newProgress
            progress.visibility = if (newProgress < 100) View.VISIBLE else View.GONE
        }

        override fun onGeolocationPermissionsShowPrompt(origin: String, callback: GeolocationPermissions.Callback) {
            if (!origin.startsWith("https://$HOST")) {
                callback.invoke(origin, false, false)
                return
            }
            val granted = listOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
                .any { ContextCompat.checkSelfPermission(this@MainActivity, it) == PackageManager.PERMISSION_GRANTED }
            if (granted) {
                callback.invoke(origin, true, false)
            } else {
                pendingGeo = origin to callback
                locationPermission.launch(
                    arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
                )
            }
        }

        override fun onShowFileChooser(
            webView: WebView,
            filePathCallback: ValueCallback<Array<Uri>>,
            fileChooserParams: FileChooserParams
        ): Boolean {
            finishFileChooser(null) // a chooser left open must be answered before a new one starts
            fileCallback = filePathCallback

            val wantsImage = fileChooserParams.acceptTypes.any { it.isBlank() || it.startsWith("image/") }
            if (fileChooserParams.isCaptureEnabled && wantsImage) {
                // <input capture="environment">: straight to the camera, like Chrome on the phone.
                try {
                    val dir = File(cacheDir, "photos").apply { mkdirs() }
                    dir.listFiles()?.forEach { it.delete() } // only the photo being taken is kept
                    val file = File(dir, "photo-${System.currentTimeMillis()}.jpg")
                    val uri = FileProvider.getUriForFile(this@MainActivity, "$packageName.files", file)
                    cameraUri = uri
                    takePicture.launch(uri)
                    return true
                } catch (e: ActivityNotFoundException) {
                    cameraUri = null // no camera app: fall through to the gallery picker
                }
            }
            return try {
                pickFile.launch(fileChooserParams.createIntent())
                true
            } catch (e: ActivityNotFoundException) {
                fileCallback = null
                false
            }
        }
    }

    companion object {
        private const val HOST = "marsiro.ir"
        private const val START_URL = "https://$HOST/n"
    }
}
