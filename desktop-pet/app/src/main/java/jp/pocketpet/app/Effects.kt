package jp.pocketpet.app

import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import kotlin.math.min
import kotlin.math.sin
import kotlin.random.Random

enum class Fx { HEART, ZZZ, NOTE, STAR, SWEAT, BANG, QUESTION, DUST, CRUMB, ANGER }

/** ハート・Zzz・音符などの小さな演出。座標はペットのウィンドウ内(px)。 */
class Effects(private val unit: Float) {
    private class P(
        val type: Fx, var x: Float, var y: Float, var vx: Float, var vy: Float,
        var life: Float, val maxLife: Float, val size: Float, var seed: Float,
    )

    private val list = ArrayList<P>()
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND
    }
    private val text = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        textAlign = Paint.Align.CENTER
        isFakeBoldText = true
    }
    private val path = Path()

    val isEmpty get() = list.isEmpty()

    fun emit(type: Fx, x: Float, y: Float) {
        val u = unit
        val p = when (type) {
            Fx.HEART -> P(type, x + rnd(8f) * u, y, rnd(10f) * u, -38f * u, 1.3f, 1.3f, 7f * u, Random.nextFloat())
            Fx.ZZZ -> P(type, x, y, 12f * u, -22f * u, 2.0f, 2.0f, 9f * u, Random.nextFloat())
            Fx.NOTE -> P(type, x + rnd(6f) * u, y, rnd(14f) * u, -30f * u, 1.4f, 1.4f, 8f * u, Random.nextFloat())
            Fx.STAR -> P(type, x, y, 0f, 0f, 2.2f, 2.2f, 4f * u, Random.nextFloat() * 6.28f)
            Fx.SWEAT -> P(type, x, y, 6f * u, 10f * u, 0.9f, 0.9f, 5f * u, 0f)
            Fx.BANG -> P(type, x, y, 0f, -10f * u, 0.9f, 0.9f, 16f * u, 0f)
            Fx.QUESTION -> P(type, x, y, 0f, -8f * u, 1.3f, 1.3f, 14f * u, 0f)
            Fx.ANGER -> P(type, x, y, 0f, -6f * u, 1.0f, 1.0f, 7f * u, 0f)
            Fx.DUST -> P(type, x, y, rnd(40f) * u, -rnd2(6f, 16f) * u, 0.5f, 0.5f, rnd2(3f, 6f) * u, 0f)
            Fx.CRUMB -> P(type, x, y, rnd(25f) * u, -rnd2(10f, 30f) * u, 0.6f, 0.6f, 1.6f * u, 0f)
        }
        list.add(p)
        if (list.size > 40) list.removeAt(0)
    }

    fun update(dt: Float, gravity: Float) {
        val it = list.iterator()
        while (it.hasNext()) {
            val p = it.next()
            p.life -= dt
            if (p.life <= 0f) { it.remove(); continue }
            when (p.type) {
                Fx.CRUMB, Fx.SWEAT -> p.vy += gravity * 0.25f * dt
                Fx.ZZZ -> p.vx = 12f * unit + sin(p.life * 3f) * 10f * unit
                Fx.STAR -> p.seed += dt * 4f
                else -> {}
            }
            p.x += p.vx * dt
            p.y += p.vy * dt
        }
    }

    fun clear() = list.clear()

    fun draw(c: Canvas) {
        for (p in list) {
            val t = p.life / p.maxLife
            val alpha = (min(1f, t * 2.5f) * 255).toInt()
            when (p.type) {
                Fx.HEART -> {
                    paint.color = Color.argb(alpha, 255, 90, 130)
                    val s = p.size * (0.7f + 0.3f * min(1f, (1f - t) * 4f))
                    PetRenderer.heartPath(path, p.x, p.y, s)
                    c.drawPath(path, paint)
                }
                Fx.ZZZ -> {
                    text.color = Color.argb(alpha, 110, 130, 200)
                    text.textSize = p.size * (1.4f - t * 0.6f)
                    c.drawText("Z", p.x, p.y, text)
                }
                Fx.NOTE -> {
                    text.color = Color.argb(alpha, 240, 130, 60)
                    text.textSize = p.size * 1.6f
                    c.drawText(if (p.seed > 0.5f) "♪" else "♫", p.x, p.y, text)
                }
                Fx.STAR -> {
                    paint.color = Color.argb(alpha, 255, 200, 40)
                    for (i in 0 until 3) {
                        val a = p.seed + i * 2.094f
                        val sx = p.x + kotlin.math.cos(a) * 14f * unit
                        val sy = p.y + sin(a) * 4f * unit
                        star(c, sx, sy, p.size)
                    }
                }
                Fx.SWEAT -> {
                    paint.color = Color.argb(alpha, 110, 180, 240)
                    path.reset()
                    path.moveTo(p.x, p.y - p.size)
                    path.quadTo(p.x + p.size * 0.9f, p.y + p.size * 0.3f, p.x, p.y + p.size * 0.6f)
                    path.quadTo(p.x - p.size * 0.9f, p.y + p.size * 0.3f, p.x, p.y - p.size)
                    c.drawPath(path, paint)
                }
                Fx.BANG, Fx.QUESTION -> {
                    text.color = Color.argb(alpha, 240, 70, 70)
                    if (p.type == Fx.QUESTION) text.color = Color.argb(alpha, 90, 120, 220)
                    text.textSize = p.size
                    c.drawText(if (p.type == Fx.BANG) "!" else "?", p.x, p.y, text)
                }
                Fx.ANGER -> {
                    stroke.color = Color.argb(alpha, 230, 60, 60); stroke.strokeWidth = 2f * unit
                    val s = p.size
                    for (q in 0 until 4) {
                        val qx = if (q % 2 == 0) -1 else 1
                        val qy = if (q < 2) -1 else 1
                        path.reset()
                        path.moveTo(p.x + qx * s * 0.25f, p.y + qy * s)
                        path.quadTo(p.x + qx * s * 0.3f, p.y + qy * s * 0.3f, p.x + qx * s, p.y + qy * s * 0.25f)
                        c.drawPath(path, stroke)
                    }
                }
                Fx.DUST -> {
                    paint.color = Color.argb((alpha * 0.6f).toInt(), 200, 190, 180)
                    c.drawCircle(p.x, p.y, p.size * (1.5f - t * 0.5f), paint)
                }
                Fx.CRUMB -> {
                    paint.color = Color.argb(alpha, 200, 160, 110)
                    c.drawCircle(p.x, p.y, p.size, paint)
                }
            }
        }
    }

    private fun star(c: Canvas, x: Float, y: Float, s: Float) {
        path.reset()
        for (i in 0 until 10) {
            val r = if (i % 2 == 0) s else s * 0.45f
            val a = -Math.PI / 2 + i * Math.PI / 5
            val px = x + (kotlin.math.cos(a) * r).toFloat()
            val py = y + (sin(a) * r).toFloat()
            if (i == 0) path.moveTo(px, py) else path.lineTo(px, py)
        }
        path.close()
        c.drawPath(path, paint)
    }

    private fun rnd(r: Float) = (Random.nextFloat() * 2f - 1f) * r
    private fun rnd2(a: Float, b: Float) = a + Random.nextFloat() * (b - a)
}
