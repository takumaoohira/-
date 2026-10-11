package jp.pocketpet.app

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.content.res.Configuration
import android.graphics.PixelFormat
import android.os.Build
import android.os.IBinder
import android.provider.Settings
import android.view.Choreographer
import android.view.Gravity
import android.view.WindowInsets
import android.view.WindowManager
import kotlin.math.roundToInt

/**
 * ペットを他のアプリの上(ホーム画面など)に表示し続ける常駐サービス。
 * 小さな透明ウィンドウを1つ作り、ペットの動きに合わせて毎フレーム位置を動かす。
 */
class PetService : Service(), Choreographer.FrameCallback {

    companion object {
        const val ACTION_START = "jp.pocketpet.START"
        const val ACTION_RELOAD = "jp.pocketpet.RELOAD"
        const val ACTION_FEED = "jp.pocketpet.FEED"
        const val ACTION_CALL = "jp.pocketpet.CALL"
        const val ACTION_SLEEP = "jp.pocketpet.SLEEP"
        const val ACTION_STOP = "jp.pocketpet.STOP"
        private const val CHANNEL = "pet"
        private const val NOTIF_ID = 1

        @Volatile var isRunning = false
            private set

        fun send(context: Context, action: String) {
            val i = Intent(context, PetService::class.java).setAction(action)
            if (action == ACTION_START || action == ACTION_RELOAD) context.startForegroundService(i)
            else context.startService(i)
        }
    }

    private lateinit var prefs: PetPrefs
    private lateinit var wm: WindowManager
    private var pet: Pet? = null
    private var view: PetView? = null
    private var lp: WindowManager.LayoutParams? = null
    private var lastFrame = 0L
    private var screenOn = true
    private var saveIn = 30f
    private var frameSkip = 0

    private val screenReceiver = object : BroadcastReceiver() {
        override fun onReceive(c: Context, i: Intent) {
            screenOn = i.action != Intent.ACTION_SCREEN_OFF
            if (screenOn) { lastFrame = 0L; Choreographer.getInstance().postFrameCallback(this@PetService) }
            else pet?.let { prefs.saveMood(it) }
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        prefs = PetPrefs(this)
        wm = getSystemService(WINDOW_SERVICE) as WindowManager
        createChannel()
        val filter = IntentFilter().apply {
            addAction(Intent.ACTION_SCREEN_OFF); addAction(Intent.ACTION_SCREEN_ON)
        }
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(screenReceiver, filter, RECEIVER_NOT_EXPORTED)
        else registerReceiver(screenReceiver, filter)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startInForeground()
        if (!Settings.canDrawOverlays(this)) {
            stopSelf()
            return START_NOT_STICKY
        }
        when (intent?.action) {
            ACTION_STOP -> { shutdown(); return START_NOT_STICKY }
            ACTION_FEED -> pet?.feed()
            ACTION_CALL -> pet?.call()
            ACTION_SLEEP -> pet?.sleepNow()
            ACTION_RELOAD -> { removePet(); addPet() }
            else -> if (pet == null) addPet()
        }
        if (pet == null) addPet()
        prefs.running = true
        isRunning = true
        return START_STICKY
    }

    private fun shutdown() {
        prefs.running = false
        removePet()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        removePet()
        isRunning = false
        runCatching { unregisterReceiver(screenReceiver) }
        super.onDestroy()
    }

    // ---------------------------------------------------------------- ウィンドウ

    @SuppressLint("ClickableViewAccessibility")
    private fun addPet() {
        val density = resources.displayMetrics.density
        val p = Pet(prefs.breed, prefs.name, prefs.petDp() * density, prefs.activityFactor())
        prefs.loadMood(p)
        val v = PetView(this, p, stage = false)
        var flags = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS or
            WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED
        if (prefs.ghost) flags = flags or WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE
        val params = WindowManager.LayoutParams(
            p.win, p.win,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            flags,
            PixelFormat.TRANSLUCENT,
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            if (Build.VERSION.SDK_INT >= 28) {
                layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
            }
            if (Build.VERSION.SDK_INT >= 31 && prefs.ghost) alpha = 0.8f // 透過時はシステムの制限上 0.8 以下が必要
        }
        applyBounds(p)
        params.x = p.x.roundToInt(); params.y = p.y.roundToInt()
        wm.addView(v, params)
        pet = p; view = v; lp = params
        lastFrame = 0L
        Choreographer.getInstance().postFrameCallback(this)
    }

    private fun removePet() {
        Choreographer.getInstance().removeFrameCallback(this)
        pet?.let { prefs.saveMood(it) }
        view?.let { runCatching { wm.removeView(it) } }
        view = null; pet = null; lp = null
    }

    private fun applyBounds(p: Pet) {
        val w: Int
        val h: Int
        var top: Int
        var bottom: Int
        if (Build.VERSION.SDK_INT >= 30) {
            val m = wm.currentWindowMetrics
            w = m.bounds.width(); h = m.bounds.height()
            val ins = m.windowInsets.getInsetsIgnoringVisibility(
                WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout()
            )
            top = ins.top; bottom = ins.bottom
        } else {
            val dm = android.util.DisplayMetrics()
            @Suppress("DEPRECATION") wm.defaultDisplay.getRealMetrics(dm)
            w = dm.widthPixels; h = dm.heightPixels
            top = dimen("status_bar_height"); bottom = dimen("navigation_bar_height")
        }
        p.setBounds(w, h, top, bottom)
    }

    @SuppressLint("DiscouragedApi", "InternalInsetResource")
    private fun dimen(name: String): Int {
        val id = resources.getIdentifier(name, "dimen", "android")
        return if (id > 0) resources.getDimensionPixelSize(id) else 0
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        pet?.let { applyBounds(it) }
    }

    override fun doFrame(frameTimeNanos: Long) {
        val p = pet ?: return
        val v = view ?: return
        val params = lp ?: return
        if (!screenOn) return
        Choreographer.getInstance().postFrameCallback(this)

        // 寝ているときは 20fps 程度に落として電池を節約
        if (p.action == Action.SLEEP && p.fx.isEmpty && p.bubble == null) {
            frameSkip = (frameSkip + 1) % 3
            if (frameSkip != 0) return
        }
        val dt = if (lastFrame == 0L) 0.016f else (frameTimeNanos - lastFrame) / 1e9f
        lastFrame = frameTimeNanos
        p.update(dt)

        val nx = p.x.roundToInt()
        val ny = p.y.roundToInt()
        if (nx != params.x || ny != params.y) {
            params.x = nx; params.y = ny
            runCatching { wm.updateViewLayout(v, params) }
        }
        v.invalidate()

        saveIn -= dt
        if (saveIn <= 0f) { saveIn = 30f; prefs.saveMood(p) }
    }

    // ---------------------------------------------------------------- 通知

    private fun createChannel() {
        val nm = getSystemService(NotificationManager::class.java)
        val ch = NotificationChannel(CHANNEL, "ペット", NotificationManager.IMPORTANCE_LOW).apply {
            description = "ペットを表示している間の通知です"
            setShowBadge(false)
        }
        nm.createNotificationChannel(ch)
    }

    private fun startInForeground() {
        val n = buildNotification()
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(NOTIF_ID, n)
        }
    }

    private fun buildNotification(): Notification {
        fun action(a: String, req: Int) = PendingIntent.getService(
            this, req, Intent(this, PetService::class.java).setAction(a),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val open = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val name = prefs.name
        return Notification.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_paw)
            .setContentTitle("${name}がおさんぽ中")
            .setContentText("タップで設定 / ダブルタップでごはん / 長押しでなでなで")
            .setContentIntent(open)
            .setOngoing(true)
            .addAction(Notification.Action.Builder(null, "ごはん", action(ACTION_FEED, 1)).build())
            .addAction(Notification.Action.Builder(null, "おいで", action(ACTION_CALL, 2)).build())
            .addAction(Notification.Action.Builder(null, "しまう", action(ACTION_STOP, 3)).build())
            .build()
    }
}
