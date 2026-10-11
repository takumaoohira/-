package jp.pocketpet.app

import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

/**
 * ペットを仮想単位(幅≒100, 足元 y=0, 右向き)で描く。
 * 呼び出し側で translate / scale(向きは scale(-1,1)) してから draw() する。
 */
class PetRenderer {
    private val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
    private val line = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
    }
    private val rect = RectF()
    private val path = Path()
    private val clip = Path()

    private lateinit var b: Breed
    private val ink = Color.parseColor("#2A2230")
    private val pink = Color.parseColor("#F59AAE")
    private val tongue = Color.parseColor("#F27C93")
    private val ow = 2.2f // 輪郭線の太さ

    fun draw(c: Canvas, p: Pose, breed: Breed) {
        b = breed
        c.save()
        c.translate(0f, p.hop)
        c.scale(1f + (1f - p.squash) * 0.6f, p.squash)
        when (p.posture) {
            Posture.STAND, Posture.AIR -> drawStand(c, p)
            Posture.SIT -> drawSit(c, p)
            Posture.LIE -> drawLie(c, p)
            Posture.CURL -> drawCurl(c, p)
            Posture.STRETCH -> drawStretch(c, p)
            Posture.DANGLE -> drawDangle(c, p)
        }
        c.restore()
    }

    /** おやつ(猫=おさかな / 犬=ほね)。仮想単位で (x,y) 中心。 */
    fun drawTreat(c: Canvas, species: Species, x: Float, y: Float, size: Float) {
        c.save()
        c.translate(x, y)
        c.scale(size, size)
        if (species == Species.CAT) {
            path.reset()
            path.moveTo(-9f, 0f)
            path.quadTo(-2f, -7f, 6f, 0f)
            path.quadTo(-2f, 7f, -9f, 0f)
            path.close()
            fill.color = Color.parseColor("#7FB2E5"); c.drawPath(path, fill)
            path.reset()
            path.moveTo(5f, 0f); path.lineTo(11f, -5f); path.lineTo(11f, 5f); path.close()
            c.drawPath(path, fill)
            line.color = Color.parseColor("#3C6A99"); line.strokeWidth = 1.4f
            path.reset()
            path.moveTo(-9f, 0f); path.quadTo(-2f, -7f, 6f, 0f); path.lineTo(11f, -5f); path.lineTo(11f, 5f)
            path.lineTo(6f, 0f); path.quadTo(-2f, 7f, -9f, 0f)
            c.drawPath(path, line)
            fill.color = ink; c.drawCircle(-5f, -1f, 1.2f, fill)
        } else {
            fill.color = Color.parseColor("#FFF6E5")
            line.color = Color.parseColor("#B89B72"); line.strokeWidth = 1.4f
            rect.set(-8f, -2.5f, 8f, 2.5f); c.drawRect(rect, fill)
            for (sx in floatArrayOf(-8f, 8f)) for (sy in floatArrayOf(-2.6f, 2.6f)) {
                c.drawCircle(sx, sy, 3.4f, fill); c.drawCircle(sx, sy, 3.4f, line)
            }
            c.drawRect(rect, fill)
            c.drawLine(-6f, -2.5f, 6f, -2.5f, line); c.drawLine(-6f, 2.5f, 6f, 2.5f, line)
        }
        c.restore()
    }

    // ---------------------------------------------------------------- 姿勢ごと

    private fun legAngle(p: Pose, off: Float) = sin(p.walkPhase + off) * 30f * p.walkAmp
    private fun legLift(p: Pose, off: Float) = max(0f, cos(p.walkPhase + off)) * 7f * p.walkAmp

    private fun drawStand(c: Canvas, p: Pose) {
        val air = p.posture == Posture.AIR
        val by = p.bob
        val far = darker(legColor(), 0.82f)
        // 奥の足
        if (air) {
            limb(c, 14f, -24f + by, 30f, -8f + by, 9f, far)
            limb(c, -16f, -24f + by, -32f, -10f + by, 9f, far)
        } else {
            leg(c, 14f, -24f + by, legAngle(p, PI_F), legLift(p, PI_F), far)
            leg(c, -16f, -24f + by, legAngle(p, 0f), legLift(p, 0f), far)
        }
        // しっぽ
        tail(c, -25f, -34f + by, p, air)
        // 胴体
        body(c, 0f, -32f + by, 28f, 16f, p.bodyTilt) {
            oval(c, 4f, -22f + by, 21f, 8f, b.belly, outlined = false)
            bodyPattern(c, 0f, -32f + by, 28f, 16f)
        }
        // 手前の足
        if (air) {
            limb(c, 20f, -24f + by, 36f, -10f + by, 9f, legColor())
            limb(c, -10f, -24f + by, -26f, -6f + by, 9f, legColor())
        } else {
            leg(c, 20f, -24f + by, legAngle(p, 0f), legLift(p, 0f), legColor())
            leg(c, -10f, -24f + by, legAngle(p, PI_F), legLift(p, PI_F), legColor())
        }
        head(c, 27f + p.headDx, -52f + by + p.headDy, 19f, p)
    }

    private fun drawSit(c: Canvas, p: Pose) {
        val br = p.breathe * 0.6f
        groundTail(c, -16f, -8f, 20f, -3f, -14f, 6f, p)
        // 後ろ足(太もも)
        oval(c, -8f, -15f, 17f, 14f, b.base)
        // 胴(縦長)
        body(c, -1f, -31f - br, 15f, 22f + br, 12f) {
            oval(c, 6f, -31f, 9f, 15f, b.belly, outlined = false)
            bodyPattern(c, -1f, -31f, 15f, 22f)
        }
        // 前足
        limb(c, 5f, -26f, 6f, -2f, 8.5f, darker(legColor(), 0.85f))
        val pu = p.pawUp
        val fx = lerp(13f, 22f, pu)
        val fy = lerp(-2f, -46f + sin(p.walkPhase) * 3f, pu)
        limb(c, 12f, -28f, fx, fy, 8.5f, legColor())
        oval(c, -2f, -5f, 7f, 4.5f, legColor()) // 後ろ足の先
        head(c, 7f + p.headDx, -57f - br + p.headDy, 19f, p)
        if (pu > 0.5f) { // 顔の前に来た手を頭の上に描き直す
            limb(c, lerp(12f, 18f, pu), lerp(-28f, -40f, pu), fx, fy, 8.5f, legColor())
        }
    }

    private fun drawLie(c: Canvas, p: Pose) {
        val br = p.breathe * 0.8f
        groundTail(c, -26f, -8f, -50f, -3f, -40f, -14f, p)
        body(c, 0f, -14f - br * 0.5f, 31f, 13f + br, 0f) {
            oval(c, 6f, -6f, 22f, 6f, b.belly, outlined = false)
            bodyPattern(c, 0f, -14f, 31f, 13f)
        }
        oval(c, -15f, -12f, 12f, 10f, b.base)
        oval(c, 25f, -4f, 10f, 4.5f, darker(legColor(), 0.88f))
        oval(c, 31f, -3f, 10f, 4.5f, legColor())
        head(c, 27f + p.headDx, -28f + p.headDy, 18f, p)
    }

    private fun drawCurl(c: Canvas, p: Pose) {
        val br = p.breathe
        body(c, 0f, -16f - br * 0.6f, 30f, 15.5f + br * 0.9f, 0f) {
            oval(c, 8f, -6f, 22f, 7f, b.belly, outlined = false)
            bodyPattern(c, 0f, -16f, 30f, 16f)
        }
        head(c, 16f, -15f - br * 0.3f, 15f, p)
        // しっぽで顔をくるむ
        path.reset()
        path.moveTo(-26f, -6f)
        path.quadTo(-6f, 6f, 24f + sin(p.tailAngle * 0.05f) * 1.5f, -3f)
        strokePath(c, path, if (b.tail == TailType.LONG) 7f else 8f, tailColor())
    }

    private fun drawStretch(c: Canvas, p: Pose) {
        tailRaw(c, -24f, -42f, -30f, -64f, -24f, -84f, p.tailAngle, 7f)
        limb(c, -14f, -36f, -16f, -1f, 9f, darker(legColor(), 0.82f))
        limb(c, 16f, -14f, 34f, -2f, 8.5f, darker(legColor(), 0.82f))
        body(c, 0f, -27f, 28f, 13f, 22f) {
            oval(c, 4f, -19f, 20f, 6f, b.belly, outlined = false)
            bodyPattern(c, 0f, -27f, 28f, 13f)
        }
        limb(c, -9f, -34f, -10f, -1f, 9f, legColor())
        limb(c, 20f, -14f, 42f, -2f, 8.5f, legColor())
        head(c, 30f + p.headDx, -20f + p.headDy, 18f, p)
    }

    private fun drawDangle(c: Canvas, p: Pose) {
        val hx = 0f
        val hy = -78f
        c.save()
        c.rotate(p.swing, hx, hy)
        val kick = sin(p.walkPhase) * 4f
        // しっぽ
        path.reset()
        path.moveTo(0f, -30f)
        path.quadTo(-6f + kick, -16f, 2f - kick, -4f)
        strokePath(c, path, 7f, tailColor())
        val far = darker(legColor(), 0.82f)
        limb(c, -6f, -62f, -8f - kick * 0.5f, -42f, 8f, far)
        limb(c, -6f, -36f, -8f + kick, -16f, 8.5f, far)
        body(c, 0f, -50f, 14.5f, 24f, 0f) {
            oval(c, 4f, -50f, 8f, 18f, b.belly, outlined = false)
            bodyPattern(c, 0f, -50f, 14.5f, 24f)
        }
        limb(c, 6f, -62f, 8f + kick * 0.5f, -42f, 8f, legColor())
        limb(c, 6f, -36f, 8f - kick, -16f, 8.5f, legColor())
        c.restore()
        head(c, hx + p.headDx, hy + p.headDy, 19f, p)
    }

    // ---------------------------------------------------------------- パーツ

    private fun legColor() = if (b.pattern == Pattern.SADDLE) b.belly else b.base

    private fun tailColor() = if (b.pattern == Pattern.POINT) b.base else b.base

    private fun leg(c: Canvas, hx: Float, hy: Float, angle: Float, lift: Float, color: Int) {
        val len = -hy
        val rad = Math.toRadians(angle.toDouble())
        val fx = hx + sin(rad).toFloat() * len
        val fy = min(-1f, hy + cos(rad).toFloat() * len - lift)
        limb(c, hx, hy, fx, fy, 9f, color)
    }

    private fun tail(c: Canvas, bx: Float, by: Float, p: Pose, air: Boolean) {
        when (b.tail) {
            TailType.LONG -> {
                val lift = if (air) 10f else 0f
                tailRaw(c, bx, by, bx - 16f, by - 6f - lift, bx - 14f, by - 40f, p.tailAngle, 7f)
            }
            TailType.WAG -> {
                tailRaw(c, bx, by, bx - 10f, by - 6f, bx - 12f, by - 24f, p.tailAngle, 6.5f)
                if (b.pattern == Pattern.SADDLE) { // ビーグルのしっぽの先は白
                    c.save(); c.rotate(p.tailAngle, bx, by)
                    fill.color = b.belly; c.drawCircle(bx - 12f, by - 24f, 3.6f, fill)
                    c.restore()
                }
            }
            TailType.CURL -> {
                c.save()
                c.rotate(p.tailAngle * 0.35f, bx, by)
                rect.set(bx - 13f, by - 25f, bx + 3f, by - 7f)
                line.color = b.outline; line.strokeWidth = 9f + ow
                c.drawArc(rect, 100f, 300f, false, line)
                line.color = b.base; line.strokeWidth = 9f
                c.drawArc(rect, 100f, 300f, false, line)
                line.color = b.belly; line.strokeWidth = 3.2f
                rect.inset(1.5f, 1.5f)
                c.drawArc(rect, 160f, 200f, false, line)
                c.restore()
            }
        }
    }

    private fun tailRaw(c: Canvas, bx: Float, by: Float, cx: Float, cy: Float, ex: Float, ey: Float, angle: Float, w: Float) {
        c.save()
        c.rotate(angle, bx, by)
        path.reset()
        path.moveTo(bx, by)
        path.quadTo(cx, cy, ex, ey)
        strokePath(c, path, w, tailColor())
        c.restore()
    }

    private fun groundTail(c: Canvas, bx: Float, by: Float, ex: Float, ey: Float, cx: Float, cy: Float, p: Pose) {
        val wag = sin(Math.toRadians(p.tailAngle.toDouble())).toFloat() * 8f
        path.reset()
        path.moveTo(bx, by)
        path.quadTo(cx, cy + wag * 0.4f, ex + wag * 0.3f, ey - wag)
        strokePath(c, path, if (b.tail == TailType.LONG) 7f else 8f, tailColor())
    }

    private inline fun body(c: Canvas, cx: Float, cy: Float, rx: Float, ry: Float, rot: Float, inner: () -> Unit) {
        c.save()
        c.rotate(rot, cx, cy)
        rect.set(cx - rx, cy - ry, cx + rx, cy + ry)
        fill.color = b.base
        c.drawOval(rect, fill)
        c.save()
        clip.reset(); clip.addOval(rect, Path.Direction.CW)
        c.clipPath(clip)
        inner()
        c.restore()
        rect.set(cx - rx, cy - ry, cx + rx, cy + ry)
        line.color = b.outline; line.strokeWidth = ow
        c.drawOval(rect, line)
        c.restore()
    }

    private fun bodyPattern(c: Canvas, cx: Float, cy: Float, rx: Float, ry: Float) {
        when (b.pattern) {
            Pattern.STRIPES -> {
                line.color = b.patch; line.strokeWidth = 3f
                for (i in -2..2) {
                    val x = cx + i * rx * 0.3f
                    c.drawLine(x - 2f, cy - ry, x + 2f, cy - ry * 0.25f, line)
                }
            }
            Pattern.CALICO -> {
                fill.color = b.patch; c.drawCircle(cx - rx * 0.35f, cy - ry * 0.5f, ry * 0.85f, fill)
                fill.color = Color.parseColor("#3A3436"); c.drawCircle(cx + rx * 0.45f, cy - ry * 0.7f, ry * 0.6f, fill)
            }
            Pattern.SADDLE -> {
                fill.color = b.patch
                rect.set(cx - rx * 0.8f, cy - ry * 1.2f, cx + rx * 0.5f, cy - ry * 0.05f)
                c.drawOval(rect, fill)
            }
            Pattern.POINT, Pattern.NONE -> {}
        }
    }

    private fun head(c: Canvas, hx: Float, hy: Float, r: Float, p: Pose) {
        c.save()
        c.rotate(p.headTilt, hx, hy)
        val fs = p.look * r * 0.2f
        val earUp = -p.earFlick * 3f

        // 耳(後ろ)
        if (b.ear != EarType.FLOPPY) {
            for (side in intArrayOf(-1, 1)) {
                val s = side.toFloat()
                val sharp = b.ear == EarType.CAT
                val tipX = hx + fs * 0.4f + s * r * (if (sharp) 0.78f else 0.72f)
                val tipY = hy - r * (if (sharp) 1.38f else 1.3f) + (if (side == 1) earUp else 0f)
                path.reset()
                path.moveTo(hx + fs * 0.3f + s * r * 0.12f, hy - r * 0.8f)
                path.lineTo(tipX, tipY)
                path.lineTo(hx + fs * 0.3f + s * r * 0.98f, hy - r * 0.22f)
                path.close()
                fill.color = b.base; c.drawPath(path, fill)
                line.color = b.outline; line.strokeWidth = ow; c.drawPath(path, line)
                path.reset()
                path.moveTo(hx + fs * 0.3f + s * r * 0.3f, hy - r * 0.72f)
                path.lineTo(lerp(tipX, hx + s * r * 0.6f, 0.25f), lerp(tipY, hy - r * 0.5f, 0.25f))
                path.lineTo(hx + fs * 0.3f + s * r * 0.82f, hy - r * 0.38f)
                path.close()
                fill.color = if (b.pattern == Pattern.CALICO && side == 1) Color.parseColor("#3A3436")
                else if (b.species == Species.CAT) pink else b.belly
                c.drawPath(path, fill)
            }
        }

        // 顔
        rect.set(hx - r * 1.08f, hy - r * 0.95f, hx + r * 1.08f, hy + r * 0.92f)
        fill.color = b.base
        c.drawOval(rect, fill)
        c.save()
        clip.reset(); clip.addOval(rect, Path.Direction.CW)
        c.clipPath(clip)
        facePattern(c, hx, hy, r, fs)
        c.restore()
        rect.set(hx - r * 1.08f, hy - r * 0.95f, hx + r * 1.08f, hy + r * 0.92f)
        line.color = b.outline; line.strokeWidth = ow
        c.drawOval(rect, line)

        // たれ耳(前)
        if (b.ear == EarType.FLOPPY) {
            for (side in intArrayOf(-1, 1)) {
                val s = side.toFloat()
                c.save()
                val ex = hx + fs * 0.3f + s * r * 0.92f
                val ey = hy - r * 0.05f + (if (side == 1) earUp else 0f)
                c.rotate(s * (-14f - p.earFlick * 10f), ex, hy - r * 0.6f)
                val earCol = if (b.pattern == Pattern.SADDLE) darker(b.base, 0.9f) else darker(b.base, 0.93f)
                oval(c, ex, ey, r * 0.33f, r * 0.62f, earCol)
                c.restore()
            }
        }

        // 目
        val ey = hy - r * 0.04f
        for (side in intArrayOf(-1, 1)) {
            eye(c, hx + fs + side * r * 0.42f, ey, r, p.eyes)
        }

        // 鼻と口
        val nx = hx + fs * 1.2f
        val ny = hy + r * 0.24f
        if (b.species == Species.CAT) {
            path.reset()
            path.moveTo(nx - r * 0.1f, ny - r * 0.05f)
            path.lineTo(nx + r * 0.1f, ny - r * 0.05f)
            path.lineTo(nx, ny + r * 0.06f)
            path.close()
            fill.color = Color.parseColor("#E8798F"); c.drawPath(path, fill)
        } else {
            fill.color = Color.parseColor("#2B2221")
            rect.set(nx - r * 0.17f, ny - r * 0.1f, nx + r * 0.17f, ny + r * 0.1f)
            c.drawOval(rect, fill)
            fill.color = Color.argb(150, 255, 255, 255)
            c.drawCircle(nx - r * 0.05f, ny - r * 0.04f, r * 0.04f, fill)
        }
        mouth(c, nx, ny + r * 0.1f, r, p)

        // ほっぺ
        if (p.blush) {
            fill.color = Color.argb(110, 255, 120, 150)
            for (side in intArrayOf(-1, 1)) {
                rect.set(0f, 0f, r * 0.34f, r * 0.2f)
                rect.offset(hx + fs + side * r * 0.66f - r * 0.17f, hy + r * 0.24f - r * 0.1f)
                c.drawOval(rect, fill)
            }
        }
        // ひげ
        if (b.species == Species.CAT) {
            line.color = if (Color.luminance(b.base) < 0.3f) Color.argb(150, 255, 255, 255) else Color.argb(120, 80, 60, 50)
            line.strokeWidth = 1.1f
            for (side in intArrayOf(-1, 1)) {
                val sx = nx + side * r * 0.45f
                c.drawLine(sx, ny + r * 0.06f, sx + side * r * 0.75f, ny - r * 0.08f, line)
                c.drawLine(sx, ny + r * 0.14f, sx + side * r * 0.75f, ny + r * 0.2f, line)
            }
        }
        c.restore()
    }

    private fun facePattern(c: Canvas, hx: Float, hy: Float, r: Float, fs: Float) {
        when (b.pattern) {
            Pattern.STRIPES -> {
                line.color = b.patch; line.strokeWidth = 2.6f
                for (i in -1..1) {
                    val x = hx + fs * 0.5f + i * r * 0.22f
                    c.drawLine(x, hy - r * 0.95f, x, hy - r * 0.55f, line)
                }
            }
            Pattern.CALICO -> {
                fill.color = b.patch; c.drawCircle(hx - r * 0.8f, hy - r * 0.6f, r * 0.62f, fill)
                fill.color = Color.parseColor("#3A3436"); c.drawCircle(hx + r * 0.85f, hy - r * 0.75f, r * 0.55f, fill)
            }
            Pattern.SADDLE -> { // ビーグル: 白い鼻すじ
                fill.color = b.belly
                rect.set(hx + fs - r * 0.16f, hy - r * 1f, hx + fs + r * 0.16f, hy + r * 0.2f)
                c.drawRoundRect(rect, r * 0.16f, r * 0.16f, fill)
            }
            Pattern.POINT -> { // 黒柴: 麻呂眉
                fill.color = b.patch
                for (side in intArrayOf(-1, 1)) c.drawCircle(hx + fs + side * r * 0.4f, hy - r * 0.36f, r * 0.11f, fill)
            }
            Pattern.NONE -> {}
        }
        // マズル
        fill.color = b.belly
        if (b.species == Species.DOG) {
            rect.set(hx + fs - r * 0.62f, hy + r * 0.02f, hx + fs + r * 0.62f, hy + r * 0.95f)
            c.drawOval(rect, fill)
        } else if (b.pattern != Pattern.NONE || b.base != b.belly) {
            rect.set(hx + fs - r * 0.42f, hy + r * 0.12f, hx + fs + r * 0.42f, hy + r * 0.62f)
            c.drawOval(rect, fill)
        }
    }

    private fun eye(c: Canvas, x: Float, y: Float, r: Float, e: Eyes) {
        val w = r * 0.15f
        line.color = ink
        line.strokeWidth = 2.2f
        when (e) {
            Eyes.OPEN -> {
                if (b.species == Species.CAT) {
                    fill.color = b.eye; rect.set(x - w, y - w * 1.25f, x + w, y + w * 1.25f); c.drawOval(rect, fill)
                    fill.color = ink; rect.set(x - w * 0.55f, y - w * 1.1f, x + w * 0.55f, y + w * 1.1f); c.drawOval(rect, fill)
                } else {
                    fill.color = b.eye; rect.set(x - w * 0.95f, y - w * 1.1f, x + w * 0.95f, y + w * 1.1f); c.drawOval(rect, fill)
                }
                fill.color = Color.WHITE
                c.drawCircle(x + w * 0.3f, y - w * 0.45f, w * 0.38f, fill)
            }
            Eyes.WIDE -> {
                fill.color = Color.WHITE; c.drawCircle(x, y, w * 1.35f, fill)
                line.strokeWidth = 1.4f; c.drawCircle(x, y, w * 1.35f, line)
                fill.color = ink; c.drawCircle(x, y, w * 0.55f, fill)
            }
            Eyes.BLINK -> c.drawLine(x - w, y, x + w, y, line)
            Eyes.HAPPY -> {
                path.reset(); path.moveTo(x - w * 1.1f, y + w * 0.4f)
                path.quadTo(x, y - w * 1.3f, x + w * 1.1f, y + w * 0.4f)
                c.drawPath(path, line)
            }
            Eyes.SLEEP -> {
                path.reset(); path.moveTo(x - w * 1.1f, y - w * 0.2f)
                path.quadTo(x, y + w * 1.1f, x + w * 1.1f, y - w * 0.2f)
                c.drawPath(path, line)
            }
            Eyes.HALF -> {
                fill.color = if (b.species == Species.CAT) b.eye else ink
                rect.set(x - w, y - w * 0.15f, x + w, y + w * 0.8f); c.drawOval(rect, fill)
                c.drawLine(x - w * 1.15f, y - w * 0.1f, x + w * 1.15f, y - w * 0.1f, line)
            }
            Eyes.DIZZY -> {
                line.strokeWidth = 1.5f
                path.reset()
                var a = 0.0
                var first = true
                while (a < Math.PI * 5) {
                    val rr = w * 1.3f * (a / (Math.PI * 5)).toFloat()
                    val px = x + cos(a).toFloat() * rr
                    val py = y + sin(a).toFloat() * rr
                    if (first) { path.moveTo(px, py); first = false } else path.lineTo(px, py)
                    a += 0.35
                }
                c.drawPath(path, line)
            }
            Eyes.HEART -> {
                fill.color = Color.parseColor("#FF4F7B")
                heartPath(path, x, y, w * 1.4f)
                c.drawPath(path, fill)
            }
        }
    }

    private fun mouth(c: Canvas, nx: Float, ny: Float, r: Float, p: Pose) {
        val w = r * 0.17f
        line.color = ink; line.strokeWidth = 1.6f
        fun omega() {
            path.reset()
            path.moveTo(nx - w * 1.1f, ny)
            path.quadTo(nx - w * 0.55f, ny + w * 0.9f, nx, ny)
            path.quadTo(nx + w * 0.55f, ny + w * 0.9f, nx + w * 1.1f, ny)
            c.drawPath(path, line)
        }
        when (p.mouth) {
            Mouth.NONE -> {}
            Mouth.SMILE -> omega()
            Mouth.OPEN, Mouth.CHEW -> {
                val open = if (p.mouth == Mouth.CHEW) 0.25f + 0.75f * p.chew else 1f
                fill.color = Color.parseColor("#9C3346")
                rect.set(nx - w * 0.8f, ny - w * 0.1f, nx + w * 0.8f, ny + w * (0.2f + 1.3f * open))
                c.drawOval(rect, fill)
                if (open > 0.5f) {
                    fill.color = tongue
                    rect.set(nx - w * 0.5f, ny + w * 0.7f * open, nx + w * 0.5f, ny + w * (0.2f + 1.3f * open))
                    c.drawOval(rect, fill)
                }
            }
            Mouth.TONGUE -> {
                omega()
                fill.color = tongue
                rect.set(nx - w * 0.35f, ny + w * 0.2f, nx + w * 0.45f, ny + w * 1.3f)
                c.drawOval(rect, fill)
            }
            Mouth.PANT -> {
                fill.color = Color.parseColor("#9C3346")
                path.reset()
                path.moveTo(nx - w * 1.2f, ny)
                path.quadTo(nx, ny + w * 2.2f, nx + w * 1.2f, ny)
                path.close()
                c.drawPath(path, fill)
                fill.color = tongue
                rect.set(nx - w * 0.6f, ny + w * 0.5f, nx + w * 0.6f, ny + w * 2.1f)
                c.drawOval(rect, fill)
            }
        }
    }

    // ---------------------------------------------------------------- 基本図形

    private fun limb(c: Canvas, x1: Float, y1: Float, x2: Float, y2: Float, w: Float, color: Int) {
        line.color = b.outline; line.strokeWidth = w + ow * 1.6f
        c.drawLine(x1, y1, x2, y2, line)
        line.color = color; line.strokeWidth = w
        c.drawLine(x1, y1, x2, y2, line)
    }

    private fun strokePath(c: Canvas, p: Path, w: Float, color: Int) {
        line.color = b.outline; line.strokeWidth = w + ow * 1.6f
        c.drawPath(p, line)
        line.color = color; line.strokeWidth = w
        c.drawPath(p, line)
    }

    private fun oval(c: Canvas, cx: Float, cy: Float, rx: Float, ry: Float, color: Int, outlined: Boolean = true) {
        rect.set(cx - rx, cy - ry, cx + rx, cy + ry)
        fill.color = color
        c.drawOval(rect, fill)
        if (outlined) {
            line.color = b.outline; line.strokeWidth = ow
            c.drawOval(rect, line)
        }
    }

    companion object {
        const val PI_F = Math.PI.toFloat()

        fun lerp(a: Float, b: Float, t: Float) = a + (b - a) * t

        fun darker(color: Int, f: Float): Int = Color.argb(
            Color.alpha(color),
            (Color.red(color) * f).toInt(),
            (Color.green(color) * f).toInt(),
            (Color.blue(color) * f).toInt(),
        )

        fun heartPath(path: Path, x: Float, y: Float, s: Float) {
            path.reset()
            path.moveTo(x, y + s * 0.9f)
            path.cubicTo(x - s * 1.4f, y - s * 0.1f, x - s * 0.7f, y - s * 1.1f, x, y - s * 0.4f)
            path.cubicTo(x + s * 0.7f, y - s * 1.1f, x + s * 1.4f, y - s * 0.1f, x, y + s * 0.9f)
            path.close()
        }
    }
}
