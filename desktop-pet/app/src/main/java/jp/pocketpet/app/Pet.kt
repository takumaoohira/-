package jp.pocketpet.app

import java.util.Calendar
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sign
import kotlin.math.sin
import kotlin.math.sqrt
import kotlin.random.Random

enum class Action {
    IDLE, WALK, RUN, SIT, LIE, SLEEP, STRETCH, GROOM, LOOK, SPIN, ZOOMIES, BEG, LONELY,
    CLIMB, HANG, FALL, LAND, DIZZY, DRAGGED, PETTED, HAPPY, SURPRISED, EAT, WAVE,
}

enum class Surface { FLOOR, LEFT, RIGHT, AIR }

/**
 * ペットの頭脳。
 * - 位置(x,y)はペットを囲む正方形ウィンドウの左上(px)。画面座標でもプレビュー座標でも同じ。
 * - 気分(おなか・げんき・なかよし度)で次の行動が変わる。
 * - タップ / ダブルタップ / 長押しなでなで / つまんで投げる / 振り回す に反応する。
 */
class Pet(
    var breed: Breed,
    var name: String,
    petPx: Float,
    var activity: Float,
) {
    var petPx = petPx; private set
    var unit = petPx / 100f; private set          // 仮想単位 → px
    var win = (petPx * 1.7f).toInt(); private set  // ウィンドウ一辺(px)
    var fx = Effects(unit); private set
    val pose = Pose()

    // 位置と運動
    var x = 0f; var y = 0f
    private var vx = 0f; private var vy = 0f
    var facing = 1; private set
    var surface = Surface.AIR; private set
    var action = Action.FALL; private set
    private var t = 0f
    private var dur = 0f
    private var clock = 0f
    private var placed = false

    // 画面の境界
    private var minX = 0f; private var maxX = 0f
    private var floorY = 0f; private var topY = 0f

    // 気分 0..100
    var hunger = 30f
    var energy = 80f
    var affection = 60f

    // 予定
    private var targetX = 0f
    private var targetY = 0f
    private var climbDir = -1
    private var next: Action? = null
    private var thenClimb = false
    private var zoomLaps = 0
    private var pendingFeed = false
    private var pendingCall = false
    private var pendingSleep = false
    private var greet = true
    private var hardLanding = false
    private var dizzyOnLand = false

    // 表情・吹き出し
    var bubble: String? = null; private set
    var bubbleLeft = 0f; private set
    private var blinkIn = 2f
    private var blinkLeft = 0f
    private var chatterIn = 30f
    private var fxTimer = 0f
    private var idleLook = 1f
    private var swing = 0f

    // おやつ
    var treatVisible = false; private set
    var treatY = 0f; private set
    var treatScale = 1f; private set

    // タッチ
    private var pressed = false
    private var pressT = 0f
    private var dragging = false
    private var petting = false
    private var downX = 0f; private var downY = 0f
    private var grabDX = 0f; private var grabDY = 0f
    private var lastX = 0f; private var lastY = 0f
    private var dragVx = 0f; private var dragVy = 0f
    private var shake = 0f
    private var lastShakeSign = 0f
    private var tapCount = 0
    private var tapTimer = 0f
    private var tapStreak = 0f

    // ---- 速度(px/秒)
    private val walkSpeed get() = petPx * 0.6f * activity
    private val runSpeed get() = petPx * 2.0f * (0.6f + activity * 0.4f)
    private val climbSpeed get() = petPx * 0.5f * activity
    val gravity get() = petPx * 28f

    val isCat get() = breed.species == Species.CAT
    val surfaceRot get() = when (surface) {
        Surface.LEFT -> 90f
        Surface.RIGHT -> -90f
        else -> 0f
    }

    fun resize(newPetPx: Float) {
        val cx = x + win / 2f
        val bottom = y + win
        petPx = newPetPx
        unit = petPx / 100f
        win = (petPx * 1.7f).toInt()
        fx = Effects(unit)
        x = cx - win / 2f
        y = bottom - win
    }

    /** 画面(またはプレビュー領域)の大きさを教える。 */
    fun setBounds(w: Int, h: Int, topInset: Int, bottomInset: Int) {
        minX = 0f
        maxX = max(0f, (w - win).toFloat())
        topY = topInset.toFloat()
        floorY = max(topY, (h - bottomInset - win).toFloat())
        if (!placed) {
            placed = true
            // 画面の上からストンと落ちてくる登場
            x = minX + Random.nextFloat() * (maxX - minX)
            y = topY
            vx = 0f; vy = 0f
            surface = Surface.AIR
            start(Action.FALL, 10f)
            return
        }
        x = x.coerceIn(minX, maxX)
        y = y.coerceIn(topY, floorY)
        when (surface) {
            Surface.FLOOR -> y = floorY
            Surface.LEFT -> x = minX
            Surface.RIGHT -> x = maxX
            Surface.AIR -> {}
        }
        targetX = targetX.coerceIn(minX, maxX)
    }

    // ================================================================ 毎フレーム

    fun update(dtRaw: Float) {
        val dt = min(dtRaw, 0.05f)
        clock += dt
        t += dt
        needs(dt)
        blink(dt)
        if (bubbleLeft > 0f) { bubbleLeft -= dt; if (bubbleLeft <= 0f) bubble = null }
        tapStreak = max(0f, tapStreak - dt * 0.6f)
        shake = max(0f, shake - dt * 1.5f)

        if (pressed && !dragging && !petting) {
            pressT += dt
            if (pressT > 0.45f && action != Action.FALL && surface == Surface.FLOOR) startPetting()
        }
        if (tapTimer > 0f) {
            tapTimer -= dt
            if (tapTimer <= 0f) {
                if (tapCount >= 2) doubleTap() else singleTap()
                tapCount = 0
            }
        }

        chatterIn -= dt
        if (chatterIn <= 0f) { chatterIn = 25f + Random.nextFloat() * 40f; chatter() }

        step(dt)
        buildPose()
        fx.update(dt, gravity)
    }

    private fun step(dt: Float) {
        when (action) {
            Action.IDLE -> {
                if (t > dur) decide()
                if (Random.nextFloat() < dt * 0.4f) idleLook = if (Random.nextBoolean()) 1f else -0.6f
            }
            Action.WALK, Action.RUN -> walkStep(dt, if (action == Action.RUN) runSpeed else walkSpeed)
            Action.ZOOMIES -> {
                val sp = runSpeed * 1.25f
                val dx = targetX - x
                if (abs(dx) <= sp * dt + 1f) {
                    x = targetX
                    zoomLaps--
                    if (zoomLaps <= 0) {
                        energy -= 8f
                        say(if (isCat) "ふぅ…" else "はぁはぁ♪")
                        start(Action.IDLE, 1.5f)
                    } else {
                        targetX = if (targetX <= minX + 1f) maxX else minX
                        dust()
                    }
                } else {
                    x += sign(dx) * sp * dt
                    facing = if (dx > 0) 1 else -1
                }
            }
            Action.SIT -> if (t > dur) {
                if (isCat && Random.nextFloat() < 0.35f) start(Action.GROOM, 3.5f) else decide()
            }
            Action.LIE -> if (t > dur) {
                if (energy < 50f || night()) startSleep() else decide()
            }
            Action.SLEEP -> {
                fxTimer -= dt
                if (fxTimer <= 0f) { fxTimer = 1.5f; fxHead(Fx.ZZZ, 6f, -6f) }
                if (t > dur && energy > 85f) {
                    start(Action.STRETCH, 1.8f)
                    say(if (night()) "ふわぁ…" else "よくねた〜")
                }
            }
            Action.STRETCH, Action.GROOM, Action.LOOK, Action.WAVE, Action.BEG, Action.LONELY ->
                if (t > dur) decide()
            Action.SPIN -> {
                fxTimer -= dt
                if (fxTimer <= 0f) { fxTimer = 0.16f; facing = -facing }
                if (t > dur) { dizzyOnLand = false; start(Action.DIZZY, 1.2f); fxHead(Fx.STAR, 0f, -4f) }
            }
            Action.CLIMB -> climbStep(dt)
            Action.HANG -> if (t > dur) {
                val r = Random.nextFloat()
                when {
                    r < 0.35f -> { climbDir = 1; start(Action.CLIMB, 99f) }
                    r < 0.55f && y > topY + petPx -> {
                        climbDir = -1; targetY = max(topY, y - petPx * (1f + Random.nextFloat() * 2f)); start(Action.CLIMB, 99f)
                    }
                    else -> jumpOff(false)
                }
            }
            Action.FALL -> fallStep(dt)
            Action.LAND -> if (t > dur) afterLanding()
            Action.DIZZY -> if (t > dur) { decide() }
            Action.DRAGGED -> {
                val target = (-dragVx / (petPx * 8f) * 35f).coerceIn(-55f, 55f)
                swing += (target - swing) * min(1f, dt * 7f)
                if (shake > 2.5f) {
                    fxTimer -= dt
                    if (fxTimer <= 0f) { fxTimer = 0.25f; fxHead(Fx.SWEAT, 14f, 0f) }
                }
                dragVx *= 0.9f
            }
            Action.PETTED -> {
                affection = min(100f, affection + dt * 6f)
                fxTimer -= dt
                if (fxTimer <= 0f) {
                    fxTimer = 0.45f
                    fxHead(Fx.HEART, 0f, -6f)
                    if (isCat && Random.nextBoolean()) fxHead(Fx.NOTE, 14f, 0f)
                }
            }
            Action.HAPPY -> {
                if (t > dur) decide()
            }
            Action.SURPRISED -> if (t > dur) decide()
            Action.EAT -> eatStep(dt)
        }
    }

    private fun walkStep(dt: Float, sp: Float) {
        val dx = targetX - x
        if (abs(dx) <= sp * dt + 1f) {
            x = targetX
            arrive()
        } else {
            x += sign(dx) * sp * dt
            facing = if (dx > 0) 1 else -1
        }
    }

    private fun arrive() {
        if (thenClimb) {
            thenClimb = false
            surface = if (x <= minX + 1f) Surface.LEFT else Surface.RIGHT
            climbDir = -1
            targetY = topY + (floorY - topY) * (0.15f + Random.nextFloat() * 0.6f)
            start(Action.CLIMB, 99f)
            say("よいしょ")
            return
        }
        val n = next
        next = null
        when (n) {
            null -> start(Action.IDLE, 0.6f + Random.nextFloat() * 1.5f)
            Action.EAT -> startEat()
            Action.WAVE -> {
                facing = if (Random.nextBoolean()) 1 else -1
                start(Action.WAVE, 2.6f)
                say(greeting())
                fxHead(Fx.HEART, 0f, -6f)
            }
            Action.BEG -> { start(Action.BEG, 4.5f); say(listOf("おなかすいた…", "ごはんまだ?", "ダブルタップでごはん!").random()) }
            Action.LONELY -> { start(Action.LONELY, 4.5f); say(listOf("かまって〜", "なでて?", "あそぼ!").random()) }
            else -> start(n, 3f)
        }
    }

    private fun climbStep(dt: Float) {
        y += climbDir * climbSpeed * dt
        facing = when (surface) {
            Surface.LEFT -> if (climbDir < 0) -1 else 1
            else -> if (climbDir < 0) 1 else -1
        }
        if (climbDir < 0) {
            if (y <= topY) {
                y = topY
                say("たかいたかい!")
                start(Action.HANG, 2f + Random.nextFloat() * 2f)
            } else if (y <= targetY) {
                start(Action.HANG, 2f + Random.nextFloat() * 3f)
            }
        } else if (y >= floorY) {
            y = floorY
            surface = Surface.FLOOR
            facing = if (x <= minX + 1f) 1 else -1
            start(Action.IDLE, 1f)
        }
    }

    private fun jumpOff(scared: Boolean) {
        val away = if (surface == Surface.LEFT) 1f else -1f
        surface = Surface.AIR
        vx = away * petPx * (if (scared) 2.5f else 4f)
        vy = -petPx * (if (scared) 2f else 5f)
        facing = away.toInt()
        start(Action.FALL, 99f)
    }

    private fun fallStep(dt: Float) {
        vy += gravity * dt
        x += vx * dt
        y += vy * dt
        if (y < topY) { y = topY; vy = abs(vy) * 0.3f }
        if (x < minX || x > maxX) {
            val left = x < minX
            x = if (left) minX else maxX
            if (isCat && vy > -petPx * 6f && y < floorY - petPx * 0.5f && Random.nextFloat() < 0.55f) {
                // 猫は壁にしがみつける
                surface = if (left) Surface.LEFT else Surface.RIGHT
                vx = 0f; vy = 0f
                climbDir = -1
                start(Action.HANG, 1.5f + Random.nextFloat() * 2f)
                say("しゅたっ")
                return
            }
            vx = -vx * 0.45f
            if (abs(vx) > petPx * 3f) fxHead(Fx.STAR, 0f, -4f)
        }
        if (vx != 0f) facing = if (vx > 0) 1 else -1
        if (y >= floorY) {
            y = floorY
            val impact = vy
            vy = 0f; vx = 0f
            surface = Surface.FLOOR
            when {
                dizzyOnLand || impact > petPx * 26f -> {
                    dizzyOnLand = false
                    dust(); dust()
                    hardLanding = true
                    start(Action.DIZZY, 2.4f)
                    fxHead(Fx.STAR, 0f, -4f)
                    say("くらくら〜")
                }
                impact > petPx * 12f -> { dust(); hardLanding = true; start(Action.LAND, 0.55f) }
                else -> { hardLanding = false; start(Action.LAND, 0.3f) }
            }
        }
    }

    private fun afterLanding() {
        if (greet) {
            greet = false
            start(Action.WAVE, 2.6f)
            say(greeting())
            fxHead(Fx.HEART, 0f, -6f)
            return
        }
        if (hardLanding) {
            hardLanding = false
            if (isCat && Random.nextBoolean()) say("スタッ!") else say("びっくりした!")
        }
        decide()
    }

    private fun eatStep(dt: Float) {
        if (t < 0.4f) {
            treatY = PetRenderer.lerp(-110f, -6f, (t / 0.4f).let { it * it })
            treatScale = 1.1f
        } else {
            treatY = -6f
            treatScale = 1.1f * max(0f, 1f - (t - 0.5f) / 2.6f)
            fxTimer -= dt
            if (fxTimer <= 0f) { fxTimer = 0.3f; fxAt(Fx.CRUMB, 44f, -10f) }
        }
        if (t > 3.2f) {
            treatVisible = false
            hunger = max(0f, hunger - 45f)
            affection = min(100f, affection + 5f)
            energy = min(100f, energy + 5f)
            say(listOf("おいしい!", "ごちそうさま♪", "もっと!").random())
            start(Action.HAPPY, 1.3f)
            fxHead(Fx.HEART, 0f, -6f)
        }
    }

    // ================================================================ 行動の決定

    private fun start(a: Action, d: Float) {
        action = a
        t = 0f
        dur = d
        fxTimer = 0f
    }

    private fun startSleep() {
        start(Action.SLEEP, 25f + Random.nextFloat() * 40f)
    }

    private fun goTo(tx: Float, run: Boolean, then: Action? = null) {
        targetX = tx.coerceIn(minX, maxX)
        next = then
        start(if (run) Action.RUN else Action.WALK, 99f)
        if (abs(targetX - x) < 2f) arrive()
    }

    private fun decide() {
        if (surface != Surface.FLOOR) return
        val center = (minX + maxX) / 2f
        if (pendingFeed) { pendingFeed = false; goTo(x, false, Action.EAT); return }
        if (pendingCall) { pendingCall = false; goTo(center, true, Action.WAVE); return }
        if (pendingSleep) { pendingSleep = false; start(Action.LIE, 1.5f); energy = min(energy, 40f); return }

        val nightNow = night()
        val tired = energy < 35f
        val r = Random.nextFloat()
        if (hunger > 70f && r < 0.45f) { goTo(center + (Random.nextFloat() - 0.5f) * petPx * 2, false, Action.BEG); return }
        if (affection < 30f && r < 0.35f) { goTo(center + (Random.nextFloat() - 0.5f) * petPx * 2, true, Action.LONELY); return }

        val choice = pick(
            Action.WALK to 3f,
            Action.IDLE to 1.5f,
            Action.SIT to 2f,
            Action.LIE to 1.2f,
            Action.LOOK to 1f,
            Action.SLEEP to (if (tired) 4f else 0.25f) + (if (nightNow) 2.5f else 0f),
            Action.RUN to (if (energy > 50f) 1f * activity else 0.1f),
            Action.ZOOMIES to (if (energy > 70f) 0.35f * activity else 0f),
            Action.CLIMB to (if (isCat && energy > 40f) 0.8f * activity else 0f),
            Action.SPIN to (if (!isCat && energy > 40f) 0.5f * activity else 0f),
            Action.GROOM to (if (isCat) 0.8f else 0f),
            Action.STRETCH to 0.4f,
        )
        when (choice) {
            Action.WALK -> goTo(randomX(), false)
            Action.RUN -> goTo(randomX(), true)
            Action.IDLE -> start(Action.IDLE, 1.5f + Random.nextFloat() * 3f)
            Action.SIT -> start(Action.SIT, 3f + Random.nextFloat() * 5f)
            Action.LIE -> start(Action.LIE, 4f + Random.nextFloat() * 6f)
            Action.LOOK -> { start(Action.LOOK, 2.5f); if (Random.nextBoolean()) fxHead(Fx.QUESTION, 14f, 0f) }
            Action.SLEEP -> { start(Action.LIE, 2f); energy = min(energy, 45f) }
            Action.ZOOMIES -> {
                zoomLaps = 2 + Random.nextInt(3)
                targetX = if (x - minX > maxX - x) minX else maxX
                start(Action.ZOOMIES, 99f)
                fxHead(Fx.BANG, 10f, 0f)
                say(if (isCat) "うにゃにゃ!" else "わわわん!")
            }
            Action.CLIMB -> {
                thenClimb = true
                targetX = if (x - minX < maxX - x) minX else maxX
                next = null
                start(Action.WALK, 99f)
            }
            Action.SPIN -> { start(Action.SPIN, 2.2f); say("しっぽ!しっぽ!") }
            Action.GROOM -> start(Action.GROOM, 3.5f)
            Action.STRETCH -> start(Action.STRETCH, 1.8f)
            else -> start(Action.IDLE, 2f)
        }
    }

    private fun pick(vararg options: Pair<Action, Float>): Action {
        val total = options.sumOf { it.second.toDouble() }.toFloat()
        var r = Random.nextFloat() * total
        for ((a, w) in options) {
            r -= w
            if (r <= 0f) return a
        }
        return options[0].first
    }

    private fun randomX(): Float {
        val span = maxX - minX
        var tx = minX + Random.nextFloat() * span
        if (abs(tx - x) < petPx * 0.6f) tx = (x + petPx * (if (Random.nextBoolean()) 1.5f else -1.5f)).coerceIn(minX, maxX)
        return tx
    }

    private fun startEat() {
        if (hunger < 10f) {
            say("おなかいっぱい…")
            start(Action.LOOK, 1.8f)
            return
        }
        start(Action.EAT, 99f)
        treatVisible = true
        treatY = -110f
        treatScale = 1.1f
        say(if (isCat) "おさかな!" else "ほね!")
    }

    private fun startPetting() {
        petting = true
        if (action == Action.SLEEP) say(if (isCat) "ごろごろ…" else "むにゃ…♪")
        else say(if (isCat) "ごろごろ♪" else "しあわせ〜")
        start(Action.PETTED, 99f)
    }

    // ================================================================ 外からの指示

    fun feed() {
        if (surface == Surface.FLOOR && action != Action.EAT && action != Action.DRAGGED) {
            next = null; thenClimb = false
            startEat()
        } else {
            pendingFeed = true
            if (surface == Surface.LEFT || surface == Surface.RIGHT) jumpOff(false)
        }
    }

    fun call() {
        if (surface == Surface.FLOOR && action != Action.DRAGGED && action != Action.EAT) {
            thenClimb = false
            say(if (isCat) "にゃ?" else "わん!")
            goTo((minX + maxX) / 2f, true, Action.WAVE)
        } else {
            pendingCall = true
            if (surface == Surface.LEFT || surface == Surface.RIGHT) jumpOff(false)
        }
    }

    fun sleepNow() {
        if (surface == Surface.FLOOR && action != Action.DRAGGED) {
            thenClimb = false
            say("おやすみ…")
            start(Action.LIE, 1.5f)
            energy = min(energy, 40f)
        } else pendingSleep = true
    }

    // ================================================================ タッチ

    fun touchDown(wx: Float, wy: Float) {
        pressed = true
        pressT = 0f
        dragging = false
        downX = wx; downY = wy
        lastX = wx; lastY = wy
        grabDX = wx - x; grabDY = wy - y
        dragVx = 0f; dragVy = 0f
    }

    fun touchMove(wx: Float, wy: Float, dt: Float) {
        if (!pressed) return
        if (!dragging && !petting) {
            val d = sqrt((wx - downX) * (wx - downX) + (wy - downY) * (wy - downY))
            if (d > petPx * 0.1f) startDrag()
        }
        if (dragging) {
            x = (wx - grabDX).coerceIn(minX - win * 0.3f, maxX + win * 0.3f)
            y = (wy - grabDY).coerceIn(topY - win * 0.3f, floorY)
            if (dt > 0f) {
                val ivx = (wx - lastX) / dt
                val ivy = (wy - lastY) / dt
                dragVx = dragVx * 0.6f + ivx * 0.4f
                dragVy = dragVy * 0.6f + ivy * 0.4f
                val s = sign(ivx)
                if (abs(ivx) > petPx * 10f && s != 0f && s != lastShakeSign) {
                    lastShakeSign = s
                    shake += 1f
                    if (shake > 4f && bubble == null) say("め、めがまわる〜")
                }
            }
        }
        lastX = wx; lastY = wy
    }

    fun touchUp() {
        if (!pressed) return
        pressed = false
        when {
            dragging -> {
                dragging = false
                val maxV = petPx * 22f
                vx = dragVx.coerceIn(-maxV, maxV)
                vy = dragVy.coerceIn(-maxV, maxV)
                dizzyOnLand = shake > 4f
                shake = 0f
                surface = Surface.AIR
                start(Action.FALL, 99f)
            }
            petting -> {
                petting = false
                start(Action.HAPPY, 1.2f)
                fxHead(Fx.HEART, 0f, -6f)
            }
            else -> {
                tapCount++
                tapTimer = 0.28f
            }
        }
    }

    fun touchCancel() {
        if (dragging || petting) touchUp() else pressed = false
    }

    private fun startDrag() {
        dragging = true
        petting = false
        next = null
        thenClimb = false
        treatVisible = false
        if (action == Action.EAT) pendingFeed = false
        swing = 0f
        shake = 0f
        surface = Surface.AIR
        // つまむ位置(首根っこ)がウィンドウの上の方に来るよう補正
        val wasSleeping = action == Action.SLEEP
        start(Action.DRAGGED, 99f)
        say(when {
            wasSleeping -> "ふぇっ!?"
            isCat -> listOf("にゃっ!?", "はなして〜", "どこいくの?").random()
            else -> listOf("わふっ!?", "たかーい!", "どこいくの?").random()
        })
    }

    private fun singleTap() {
        tapStreak += 1f
        affection = min(100f, affection + 3f)
        when {
            action == Action.SLEEP -> {
                if (Random.nextFloat() < 0.5f) {
                    say("むにゃ…")
                    t = min(t, dur - 5f)
                } else {
                    start(Action.SURPRISED, 0.9f)
                    fxHead(Fx.BANG, 10f, 0f)
                    say("ん…?")
                }
            }
            surface == Surface.LEFT || surface == Surface.RIGHT -> {
                say(if (isCat) "にゃっ!" else "わっ!")
                fxHead(Fx.BANG, 10f, 0f)
                jumpOff(true)
            }
            surface == Surface.AIR || action == Action.EAT -> {}
            tapStreak > 5f -> {
                tapStreak = 0f
                affection = max(0f, affection - 6f)
                fxHead(Fx.ANGER, 14f, 4f)
                say("もう〜!")
                goTo(if (x - minX > maxX - x) minX + petPx * 0.3f else maxX - petPx * 0.3f, true)
            }
            else -> {
                val r = Random.nextFloat()
                when {
                    r < 0.45f -> {
                        start(Action.HAPPY, 1.3f)
                        fxHead(Fx.HEART, 0f, -6f)
                        say(sound())
                    }
                    r < 0.6f -> {
                        start(Action.SURPRISED, 0.8f)
                        fxHead(Fx.BANG, 10f, 0f)
                        say(if (isCat) "にゃ!" else "わん!")
                    }
                    r < 0.75f && !isCat -> { start(Action.SPIN, 1.6f); say("わーい!") }
                    r < 0.85f -> { start(Action.WAVE, 2f); say(if (affection > 70f) "${name}だよ♪" else sound()) }
                    else -> { start(Action.LOOK, 1.8f); fxHead(Fx.QUESTION, 14f, 0f); say("なぁに?") }
                }
            }
        }
    }

    private fun doubleTap() {
        if (surface == Surface.FLOOR && action != Action.EAT) {
            next = null; thenClimb = false
            startEat()
        } else singleTap()
    }

    // ================================================================ 気分とおしゃべり

    private fun needs(dt: Float) {
        hunger = min(100f, hunger + dt * 0.008f)
        affection = max(0f, affection - dt * 0.005f)
        energy = when (action) {
            Action.SLEEP -> min(100f, energy + dt * 0.25f)
            Action.RUN, Action.ZOOMIES, Action.SPIN -> max(0f, energy - dt * 0.08f)
            else -> max(0f, energy - dt * 0.006f)
        }
    }

    /** アプリを閉じていた時間ぶん気分を進める。 */
    fun advanceOffline(seconds: Float) {
        val s = seconds.coerceIn(0f, 60f * 60f * 24f)
        hunger = min(100f, hunger + s * 0.008f)
        affection = max(0f, affection - s * 0.003f)
        energy = min(100f, energy + s * 0.05f)
    }

    private fun chatter() {
        if (action == Action.SLEEP || action == Action.DRAGGED || bubble != null) return
        val line = when {
            hunger > 70f -> listOf("おなかすいた…", "ごはん〜", "ダブルタップでごはん!").random()
            affection < 30f -> listOf("かまって〜", "さみしいな…", "なでて?").random()
            energy < 25f -> listOf("ねむい…", "ふわぁ…").random()
            affection > 80f -> listOf("だいすき!", "いっしょだね♪", "${name}はしあわせ").random()
            else -> listOf(sound(), sound(), "おしごとがんばって!", "きゅうけいしよ?", "ひまだな〜", "ぽかぽか").random()
        }
        say(line)
    }

    private fun sound() = if (isCat) listOf("にゃー", "にゃん♪", "みゃう", "にゃ〜ん").random()
    else listOf("わん!", "わんわん!", "くぅ〜ん", "へっへっ♪").random()

    private fun greeting(): String {
        val h = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
        return when (h) {
            in 5..10 -> "おはよう!"
            in 11..16 -> "こんにちは〜"
            in 17..21 -> "おつかれさま!"
            else -> "まだおきてるの?"
        }
    }

    private fun night(): Boolean {
        val h = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
        return h >= 23 || h < 6
    }

    fun say(text: String, secs: Float = 2.4f) {
        bubble = text
        bubbleLeft = secs
    }

    private fun blink(dt: Float) {
        if (blinkLeft > 0f) { blinkLeft -= dt; return }
        blinkIn -= dt
        if (blinkIn <= 0f) {
            blinkLeft = 0.12f
            blinkIn = 1.5f + Random.nextFloat() * 3.5f
        }
    }

    // ================================================================ 演出の位置

    private fun headUnit(): Pair<Float, Float> = when (pose.posture) {
        Posture.STAND, Posture.AIR -> 27f to -52f
        Posture.SIT -> 7f to -57f
        Posture.LIE -> 27f to -28f
        Posture.CURL -> 16f to -15f
        Posture.STRETCH -> 30f to -20f
        Posture.DANGLE -> 0f to -78f
    }

    /** 仮想単位 → ウィンドウ内px(向き・壁の回転込み) */
    fun toWin(ux: Float, uy: Float): Pair<Float, Float> {
        val half = win / 2f
        val px = half + ux * unit * facing
        val py = win + (uy + pose.hop) * unit
        val rot = Math.toRadians(surfaceRot.toDouble())
        val c = cos(rot).toFloat()
        val s = sin(rot).toFloat()
        val dx = px - half
        val dy = py - half
        return (half + dx * c - dy * s) to (half + dx * s + dy * c)
    }

    /** 頭の上あたり(吹き出しや演出の基準) */
    fun headTop(): Pair<Float, Float> {
        val (hx, hy) = headUnit()
        return toWin(hx, hy - 30f)
    }

    private fun fxHead(type: Fx, dx: Float, dy: Float) {
        val (hx, hy) = headUnit()
        fxAt(type, hx + dx, hy - 22f + dy)
    }

    private fun fxAt(type: Fx, ux: Float, uy: Float) {
        val (wx, wy) = toWin(ux, uy)
        fx.emit(type, wx, wy)
    }

    private fun dust() {
        for (i in 0 until 4) fxAt(Fx.DUST, (Random.nextFloat() - 0.5f) * 50f, -2f)
    }

    // ================================================================ 姿勢づくり

    private fun buildPose() {
        val p = pose
        p.reset()
        p.walkPhase = clock * 9f
        p.breathe = sin(clock * 2.2f)
        p.eyes = if (blinkLeft > 0f) Eyes.BLINK else Eyes.OPEN
        val wagFast = !isCat && affection > 50f
        p.tailAngle = if (wagFast) sin(clock * 14f) * 18f else sin(clock * 1.8f) * 9f
        p.mouth = Mouth.SMILE
        if (energy < 25f && p.eyes == Eyes.OPEN) p.eyes = Eyes.HALF

        when (action) {
            Action.IDLE -> {
                p.look = idleLook
                p.headTilt = sin(clock * 0.7f) * 4f
                if (!isCat && affection > 60f) p.mouth = Mouth.PANT
            }
            Action.WALK -> {
                p.walkAmp = 1f
                p.walkPhase = clock * 9f * (0.7f + activity * 0.3f)
                p.bob = -abs(sin(p.walkPhase)) * 1.6f
            }
            Action.RUN, Action.ZOOMIES -> {
                p.walkAmp = 1.35f
                p.walkPhase = clock * 18f
                p.bob = -abs(sin(p.walkPhase)) * 4f
                p.bodyTilt = -4f
                p.tailAngle = -18f + sin(clock * 20f) * 10f
                p.earFlick = 0.6f
                p.mouth = if (isCat) Mouth.SMILE else Mouth.PANT
            }
            Action.SIT -> {
                p.posture = Posture.SIT
                p.look = idleLook
                p.headTilt = sin(clock * 0.8f) * 6f
                if (!isCat) p.mouth = Mouth.PANT
            }
            Action.BEG -> {
                p.posture = Posture.SIT
                p.headTilt = 14f
                p.pawUp = if (isCat) 0f else 0.6f + sin(clock * 6f) * 0.15f
                p.eyes = if (p.eyes == Eyes.BLINK) Eyes.BLINK else Eyes.OPEN
                p.mouth = if (sin(clock * 3f) > 0.6f) Mouth.OPEN else Mouth.SMILE
            }
            Action.LONELY -> {
                p.posture = Posture.SIT
                p.headTilt = -10f + sin(clock * 2f) * 8f
                p.tailAngle = sin(clock * 10f) * 22f
                p.mouth = Mouth.OPEN
            }
            Action.WAVE -> {
                p.posture = Posture.SIT
                p.pawUp = 0.75f + sin(t * 10f) * 0.25f
                p.walkPhase = t * 10f
                p.eyes = Eyes.HAPPY
                p.blush = true
                p.mouth = if (isCat) Mouth.OPEN else Mouth.PANT
                p.tailAngle = sin(clock * 12f) * 20f
            }
            Action.GROOM -> {
                p.posture = Posture.SIT
                val lick = sin(t * 7f)
                p.pawUp = 0.85f + lick * 0.15f
                p.walkPhase = t * 7f
                p.eyes = Eyes.HAPPY
                p.headTilt = 12f + lick * 6f
                p.mouth = Mouth.TONGUE
            }
            Action.LIE -> {
                p.posture = Posture.LIE
                p.look = idleLook
                if (energy < 50f) p.eyes = if (p.eyes == Eyes.BLINK) Eyes.BLINK else Eyes.HALF
            }
            Action.SLEEP -> {
                p.posture = Posture.CURL
                p.eyes = Eyes.SLEEP
                p.mouth = Mouth.NONE
                p.breathe = sin(clock * 1.6f)
                p.tailAngle = sin(clock * 0.8f) * 10f
            }
            Action.STRETCH -> {
                p.posture = Posture.STRETCH
                p.eyes = Eyes.HAPPY
                p.mouth = if (t in 0.3f..1.3f) Mouth.OPEN else Mouth.SMILE
                p.tailAngle = sin(clock * 3f) * 6f
            }
            Action.LOOK -> {
                p.look = if (sin(t * 2.6f) > 0) 1f else -1f
                p.headTilt = sin(t * 2.6f) * 12f
                p.earFlick = if (sin(t * 5f) > 0.8f) 1f else 0f
            }
            Action.SPIN -> {
                p.walkAmp = 1f
                p.walkPhase = clock * 18f
                p.hop = -abs(sin(t * 8f)) * 6f
                p.eyes = Eyes.HAPPY
                p.mouth = Mouth.PANT
                p.tailAngle = sin(clock * 20f) * 25f
            }
            Action.CLIMB -> {
                p.walkAmp = 1f
                p.walkPhase = clock * 7f
                p.earFlick = 0.5f
            }
            Action.HANG -> {
                p.look = idleLook
                p.headTilt = sin(clock) * 8f
                p.tailAngle = sin(clock * 2.5f) * 14f
            }
            Action.FALL -> {
                p.posture = Posture.AIR
                p.eyes = if (vy > petPx * 8f) Eyes.WIDE else Eyes.OPEN
                p.mouth = if (vy > petPx * 8f) Mouth.OPEN else Mouth.SMILE
                p.bodyTilt = (vy / (petPx * 20f) * 20f).coerceIn(-20f, 25f)
                p.earFlick = 1f
            }
            Action.LAND -> {
                val k = 1f - t / dur
                p.squash = 1f - (if (hardLanding) 0.32f else 0.18f) * k
                p.eyes = if (hardLanding) Eyes.BLINK else Eyes.OPEN
            }
            Action.DIZZY -> {
                p.posture = Posture.SIT
                p.eyes = Eyes.DIZZY
                p.headTilt = sin(clock * 5f) * 16f
                p.mouth = Mouth.OPEN
            }
            Action.DRAGGED -> {
                p.posture = Posture.DANGLE
                p.swing = swing + sin(clock * 3f) * 4f
                p.walkPhase = clock * (if (shake > 2f) 22f else 12f)
                p.headTilt = -swing * 0.3f
                p.eyes = when {
                    shake > 3f -> Eyes.DIZZY
                    t < 0.5f -> Eyes.WIDE
                    affection > 70f -> Eyes.HAPPY
                    else -> if (blinkLeft > 0f) Eyes.BLINK else Eyes.OPEN
                }
                p.mouth = if (t < 0.6f || shake > 2f) Mouth.OPEN else Mouth.SMILE
            }
            Action.PETTED -> {
                p.posture = if (energy < 30f) Posture.LIE else Posture.SIT
                p.eyes = if (t > 2.5f) Eyes.HEART else Eyes.HAPPY
                p.blush = true
                p.headTilt = sin(clock * 2f) * 10f
                p.mouth = if (isCat) Mouth.SMILE else Mouth.PANT
                p.tailAngle = if (isCat) sin(clock * 1.5f) * 18f else sin(clock * 18f) * 25f
                p.earFlick = 0.3f
            }
            Action.HAPPY -> {
                p.hop = -abs(sin(t * 9f)) * 10f * max(0f, 1f - t / dur)
                p.walkAmp = 0.4f
                p.walkPhase = t * 12f
                p.eyes = Eyes.HAPPY
                p.blush = true
                p.mouth = if (isCat) Mouth.OPEN else Mouth.PANT
                p.tailAngle = sin(clock * 16f) * 22f
            }
            Action.SURPRISED -> {
                p.hop = -sin(min(1f, t / 0.35f) * PetRenderer.PI_F) * 12f
                p.eyes = Eyes.WIDE
                p.mouth = Mouth.OPEN
                p.earFlick = 1f
                p.tailAngle = -25f
            }
            Action.EAT -> {
                p.headDx = 6f
                p.headDy = 13f
                p.bodyTilt = 6f
                p.look = 1f
                if (t > 0.4f) {
                    p.mouth = Mouth.CHEW
                    p.chew = abs(sin(t * 11f))
                    p.eyes = Eyes.HAPPY
                    p.headDy = 13f + p.chew * 2f
                } else p.eyes = Eyes.WIDE
                p.tailAngle = sin(clock * 12f) * 18f
            }
        }
    }
}
