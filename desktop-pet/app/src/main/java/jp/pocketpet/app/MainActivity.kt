package jp.pocketpet.app

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.text.Editable
import android.text.InputType
import android.text.TextWatcher
import android.view.Gravity
import android.view.View
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.Switch
import android.widget.TextView

/** 設定画面。ペットの種類・名前・大きさ・性格を選んで、ホーム画面に出す。 */
class MainActivity : Activity() {
    private lateinit var prefs: PetPrefs
    private lateinit var previewPet: Pet
    private lateinit var preview: PetView
    private lateinit var startButton: TextView
    private lateinit var permissionBox: LinearLayout
    private lateinit var bars: List<ProgressBar>
    private val breedChips = mutableListOf<Pair<Breed, TextView>>()
    private val handler = Handler(Looper.getMainLooper())
    private val reloadTask = Runnable { if (PetService.isRunning) PetService.send(this, PetService.ACTION_RELOAD) }
    private val moodTask = object : Runnable {
        override fun run() { refreshMood(); handler.postDelayed(this, 2000) }
    }

    private val ink = Color.parseColor("#3A2E3C")
    private val accent = Color.parseColor("#FF8A5B")
    private val soft = Color.parseColor("#FFF1E6")

    private fun dp(v: Float) = v * resources.displayMetrics.density
    private fun dpi(v: Float) = dp(v).toInt()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefs = PetPrefs(this)
        window.statusBarColor = Color.parseColor("#FFF8F0")
        window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
        setContentView(buildUi())
    }

    override fun onResume() {
        super.onResume()
        preview.running = true
        preview.invalidate()
        refreshState()
        handler.post(moodTask)
    }

    override fun onPause() {
        super.onPause()
        preview.running = false
        handler.removeCallbacks(moodTask)
    }

    // ---------------------------------------------------------------- 画面づくり

    private fun buildUi(): View {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dpi(18f), dpi(20f), dpi(18f), dpi(32f))
        }
        val scroll = ScrollView(this).apply {
            setBackgroundColor(Color.parseColor("#FFF8F0"))
            addView(root)
        }

        root.addView(text("ポケットペット", 28f, bold = true))
        root.addView(text("ホーム画面やアプリの上を、ペットが自由に歩きまわります", 14f, color = Color.GRAY).apply {
            setPadding(0, dpi(2f), 0, dpi(14f))
        })

        // プレビュー
        val density = resources.displayMetrics.density
        previewPet = Pet(prefs.breed, prefs.name, prefs.petDp() * density * 0.85f, prefs.activityFactor())
        prefs.loadMood(previewPet)
        preview = PetView(this, previewPet, stage = true)
        val stage = FrameLayout(this).apply {
            background = GradientDrawable(
                GradientDrawable.Orientation.TOP_BOTTOM,
                intArrayOf(Color.parseColor("#CDEBFF"), Color.parseColor("#F3FAFF"), Color.parseColor("#DFF3D8")),
            ).apply { cornerRadius = dp(22f) }
            clipToOutline = true
            addView(preview, FrameLayout.LayoutParams(-1, -1))
        }
        root.addView(stage, LinearLayout.LayoutParams(-1, dpi(250f)))
        root.addView(text("タップ・ダブルタップ(ごはん)・長押し(なでなで)・つまんで投げる・ふりまわす…いろいろ試してみてね", 12f, color = Color.GRAY).apply {
            setPadding(dpi(4f), dpi(6f), dpi(4f), dpi(8f))
        })

        // 気分
        val moodCard = card()
        val labels = listOf("おなかいっぱい", "げんき", "なかよし")
        val colors = listOf("#FFB547", "#5BC8F5", "#FF6F91")
        bars = labels.mapIndexed { i, l ->
            val row = LinearLayout(this).apply { gravity = Gravity.CENTER_VERTICAL }
            row.addView(text(l, 13f).apply { minWidth = dpi(110f) })
            val bar = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
                max = 100
                progressTintList = android.content.res.ColorStateList.valueOf(Color.parseColor(colors[i]))
            }
            row.addView(bar, LinearLayout.LayoutParams(0, dpi(14f), 1f))
            moodCard.addView(row, LinearLayout.LayoutParams(-1, -2).apply { topMargin = if (i > 0) dpi(6f) else 0 })
            bar
        }
        root.addView(moodCard)

        // 権限のお知らせ
        permissionBox = card().apply {
            background = rounded(Color.parseColor("#FFE3E3"), 18f)
            addView(text("ホーム画面に表示するには「ほかのアプリの上に重ねて表示」の許可が必要です。", 13f))
            addView(button("許可する", Color.parseColor("#E05555")) {
                startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName")))
            }, LinearLayout.LayoutParams(-2, -2).apply { topMargin = dpi(8f) })
        }
        root.addView(permissionBox)

        // 出す / しまう
        startButton = button("ホーム画面に出す", accent) { toggleService() }.apply {
            textSize = 18f
            setPadding(0, dpi(16f), 0, dpi(16f))
        }
        root.addView(startButton, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dpi(12f); bottomMargin = dpi(6f) })

        // 種類
        root.addView(section("ねこ"))
        root.addView(breedRow(Species.CAT))
        root.addView(section("いぬ"))
        root.addView(breedRow(Species.DOG))

        // 名前
        root.addView(section("なまえ"))
        val nameEdit = EditText(this).apply {
            setText(prefs.name)
            setSingleLine()
            inputType = InputType.TYPE_CLASS_TEXT
            background = rounded(Color.WHITE, 14f)
            setPadding(dpi(14f), dpi(10f), dpi(14f), dpi(10f))
            addTextChangedListener(object : TextWatcher {
                override fun beforeTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
                override fun onTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
                override fun afterTextChanged(s: Editable?) {
                    val n = s?.toString()?.trim().orEmpty().ifEmpty { "ペット" }.take(8)
                    prefs.name = n
                    previewPet.name = n
                    scheduleReload(1200)
                }
            })
        }
        root.addView(nameEdit)

        root.addView(section("おおきさ"))
        root.addView(segmented(listOf("小", "中", "大"), prefs.size) {
            prefs.size = it
            previewPet.resize(prefs.petDp() * resources.displayMetrics.density * 0.85f)
            previewPet.setBounds(preview.width, preview.height, 0, 0)
            scheduleReload(300)
        })

        root.addView(section("せいかく"))
        root.addView(segmented(listOf("おっとり", "ふつう", "げんき"), prefs.activity) {
            prefs.activity = it
            previewPet.activity = prefs.activityFactor()
            scheduleReload(300)
        })

        root.addView(section("そのほか"))
        val opts = card()
        opts.addView(switch("タッチを透過する", "ペットがタップの邪魔をしなくなります(さわれなくなります)", prefs.ghost) {
            prefs.ghost = it; scheduleReload(300)
        })
        opts.addView(switch("スマホ起動時に自動で出す", null, prefs.autostart) { prefs.autostart = it })
        root.addView(opts)

        root.addView(text(
            "通知の「ごはん」「おいで」「しまう」からも操作できます。\n" +
                "※ iPhone はOSの制限でホーム画面に重ねて表示できないため、Android 専用です。",
            12f, color = Color.GRAY,
        ).apply { setPadding(dpi(4f), dpi(14f), dpi(4f), 0) })

        refreshChips()
        return scroll
    }

    private fun breedRow(species: Species): View {
        val row = LinearLayout(this).apply { setPadding(0, 0, 0, dpi(4f)) }
        for (b in Breeds.all.filter { it.species == species }) {
            val chip = TextView(this).apply {
                text = b.label
                textSize = 14f
                gravity = Gravity.CENTER
                setPadding(dpi(14f), dpi(9f), dpi(14f), dpi(9f))
                setOnClickListener {
                    prefs.breedId = b.id
                    previewPet.breed = b
                    previewPet.say(if (b.species == Species.CAT) "にゃー" else "わん!")
                    refreshChips()
                    scheduleReload(200)
                }
            }
            breedChips.add(b to chip)
            row.addView(chip, LinearLayout.LayoutParams(-2, -2).apply { marginEnd = dpi(8f) })
        }
        return HorizontalScrollView(this).apply {
            isHorizontalScrollBarEnabled = false
            addView(row)
        }
    }

    private fun refreshChips() {
        for ((b, chip) in breedChips) {
            val sel = b.id == prefs.breedId
            val dot = GradientDrawable().apply {
                shape = GradientDrawable.OVAL; setColor(b.base); setStroke(dpi(1.5f), b.outline)
                setSize(dpi(14f), dpi(14f))
            }
            chip.setCompoundDrawablesRelativeWithIntrinsicBounds(dot, null, null, null)
            chip.compoundDrawablePadding = dpi(6f)
            chip.background = rounded(if (sel) accent else Color.WHITE, 20f)
            chip.setTextColor(if (sel) Color.WHITE else ink)
            chip.typeface = if (sel) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
        }
    }

    private fun segmented(options: List<String>, selected: Int, onSelect: (Int) -> Unit): View {
        val row = LinearLayout(this).apply { background = rounded(Color.WHITE, 16f); setPadding(dpi(4f), dpi(4f), dpi(4f), dpi(4f)) }
        val views = mutableListOf<TextView>()
        fun paint(sel: Int) = views.forEachIndexed { i, v ->
            v.background = if (i == sel) rounded(accent, 13f) else null
            v.setTextColor(if (i == sel) Color.WHITE else ink)
        }
        options.forEachIndexed { i, o ->
            val v = TextView(this).apply {
                text = o; textSize = 14f; gravity = Gravity.CENTER
                setPadding(0, dpi(9f), 0, dpi(9f))
                setOnClickListener { paint(i); onSelect(i) }
            }
            views.add(v)
            row.addView(v, LinearLayout.LayoutParams(0, -2, 1f))
        }
        paint(selected)
        return row
    }

    @Suppress("DEPRECATION")
    private fun switch(label: String, sub: String?, checked: Boolean, onChange: (Boolean) -> Unit): View {
        val row = LinearLayout(this).apply { gravity = Gravity.CENTER_VERTICAL; setPadding(0, dpi(4f), 0, dpi(4f)) }
        val texts = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        texts.addView(text(label, 15f))
        if (sub != null) texts.addView(text(sub, 12f, color = Color.GRAY))
        row.addView(texts, LinearLayout.LayoutParams(0, -2, 1f))
        row.addView(Switch(this).apply {
            isChecked = checked
            setOnCheckedChangeListener { _, v -> onChange(v) }
        })
        return row
    }

    private fun section(title: String) = text(title, 15f, bold = true).apply {
        setPadding(dpi(4f), dpi(18f), 0, dpi(8f))
    }

    private fun card() = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        background = rounded(Color.WHITE, 18f)
        setPadding(dpi(16f), dpi(14f), dpi(16f), dpi(14f))
        layoutParams = LinearLayout.LayoutParams(-1, -2).apply { topMargin = dpi(8f) }
    }

    private fun text(s: String, size: Float, bold: Boolean = false, color: Int = ink) = TextView(this).apply {
        text = s; textSize = size; setTextColor(color)
        if (bold) typeface = Typeface.DEFAULT_BOLD
    }

    private fun button(label: String, color: Int, onClick: () -> Unit) = TextView(this).apply {
        text = label; textSize = 15f; gravity = Gravity.CENTER
        setTextColor(Color.WHITE); typeface = Typeface.DEFAULT_BOLD
        background = rounded(color, 26f)
        setPadding(dpi(22f), dpi(10f), dpi(22f), dpi(10f))
        setOnClickListener { onClick() }
    }

    private fun rounded(color: Int, r: Float) = GradientDrawable().apply {
        setColor(color); cornerRadius = dp(r)
    }

    // ---------------------------------------------------------------- 動作

    private fun toggleService() {
        if (PetService.isRunning) {
            PetService.send(this, PetService.ACTION_STOP)
            handler.postDelayed({ refreshState() }, 300)
            return
        }
        if (!Settings.canDrawOverlays(this)) {
            startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName")))
            return
        }
        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1)
        }
        PetService.send(this, PetService.ACTION_START)
        handler.postDelayed({ refreshState() }, 300)
        // ホーム画面に戻ってペットを見てもらう
        handler.postDelayed({
            startActivity(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }, 600)
    }

    private fun scheduleReload(delay: Long) {
        handler.removeCallbacks(reloadTask)
        handler.postDelayed(reloadTask, delay)
    }

    private fun refreshState() {
        val granted = Settings.canDrawOverlays(this)
        permissionBox.visibility = if (granted) View.GONE else View.VISIBLE
        val running = PetService.isRunning
        startButton.text = if (running) "しまう" else "ホーム画面に出す"
        startButton.background = rounded(if (running) Color.parseColor("#9A8F9C") else accent, 26f)
    }

    private fun refreshMood() {
        val tmp = Pet(prefs.breed, prefs.name, 100f, 1f)
        prefs.loadMood(tmp)
        val src = if (PetService.isRunning) tmp else previewPet
        bars[0].progress = (100 - src.hunger).toInt()
        bars[1].progress = src.energy.toInt()
        bars[2].progress = src.affection.toInt()
    }
}
