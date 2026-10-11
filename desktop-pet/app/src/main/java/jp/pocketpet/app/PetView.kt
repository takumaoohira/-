package jp.pocketpet.app

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.view.MotionEvent
import android.view.View
import kotlin.math.max
import kotlin.math.min

/**
 * ペットを描く View。
 * - overlay モード: View = ペットのウィンドウそのもの。位置はサービスが WindowManager で動かす。
 * - stage モード: View の中を小さな「画面」に見立て、その中でペットが動き回る(設定画面のプレビュー)。
 */
@SuppressLint("ViewConstructor")
class PetView(context: Context, var pet: Pet, private val stage: Boolean) : View(context) {
    private val renderer = PetRenderer()
    private val bubbleFill = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE }
    private val bubbleLine = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE; color = Color.parseColor("#5A4E5E")
    }
    private val bubbleText = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#3A2E3C"); textAlign = Paint.Align.CENTER; isFakeBoldText = true
    }
    private val shadow = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.argb(40, 0, 0, 0) }
    private val rect = RectF()
    private val tail = Path()
    private var lastFrame = 0L
    private var lastTouch = 0L

    /** stage モードのとき、外からペットを止めたいとき用 */
    var running = true

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        if (stage) pet.setBounds(w, h, 0, 0)
    }

    override fun onDraw(canvas: Canvas) {
        if (stage && running) {
            val now = System.nanoTime()
            val dt = if (lastFrame == 0L) 0.016f else (now - lastFrame) / 1e9f
            lastFrame = now
            pet.update(dt)
        }
        canvas.save()
        if (stage) canvas.translate(pet.x, pet.y)
        drawPet(canvas)
        canvas.restore()
        if (stage && running) postInvalidateOnAnimation()
    }

    private fun drawPet(c: Canvas) {
        val w = pet.win.toFloat()
        val u = pet.unit
        // 床の影
        if (pet.surface == Surface.FLOOR) {
            val sw = if (pet.pose.posture == Posture.CURL || pet.pose.posture == Posture.LIE) 34f else 30f
            val hopK = 1f + pet.pose.hop / 40f
            rect.set(w / 2 - sw * u * hopK, w - 4f * u, w / 2 + sw * u * hopK, w + 1f * u)
            c.drawOval(rect, shadow)
        }
        c.save()
        c.rotate(pet.surfaceRot, w / 2, w / 2)
        c.translate(w / 2, w)
        c.scale(u * pet.facing, u)
        renderer.draw(c, pet.pose, pet.breed)
        if (pet.treatVisible) renderer.drawTreat(c, pet.breed.species, 46f, pet.treatY, pet.treatScale)
        c.restore()
        pet.fx.draw(c)
        drawBubble(c)
    }

    private fun drawBubble(c: Canvas) {
        val text = pet.bubble ?: return
        val w = pet.win.toFloat()
        val u = pet.unit
        val alpha = (min(1f, pet.bubbleLeft * 4f) * 255).toInt()
        bubbleText.textSize = 15f * u
        var tw = bubbleText.measureText(text)
        val maxW = w - 8f * u
        if (tw + 14f * u > maxW) {
            bubbleText.textSize *= maxW / (tw + 14f * u)
            tw = bubbleText.measureText(text)
        }
        val bw = tw + 14f * u
        val bh = bubbleText.textSize + 10f * u
        val (hx, hy) = pet.headTop()
        val cx = hx.coerceIn(bw / 2 + 2f, w - bw / 2 - 2f)
        val bottom = max(bh + 2f, min(hy, w - 4f))
        rect.set(cx - bw / 2, bottom - bh, cx + bw / 2, bottom)
        bubbleFill.alpha = alpha
        bubbleLine.alpha = alpha
        bubbleLine.strokeWidth = 1.5f * u
        bubbleText.alpha = alpha
        val r = bh / 2
        c.drawRoundRect(rect, r, r, bubbleFill)
        c.drawRoundRect(rect, r, r, bubbleLine)
        val tx = hx.coerceIn(rect.left + r, rect.right - r)
        tail.reset()
        tail.moveTo(tx - 4f * u, bottom - 0.5f)
        tail.lineTo(tx, bottom + 5f * u)
        tail.lineTo(tx + 4f * u, bottom - 0.5f)
        c.drawPath(tail, bubbleFill)
        c.drawLine(tx - 4f * u, bottom, tx, bottom + 5f * u, bubbleLine)
        c.drawLine(tx, bottom + 5f * u, tx + 4f * u, bottom, bubbleLine)
        val fm = bubbleText.fontMetrics
        c.drawText(text, cx, rect.centerY() - (fm.ascent + fm.descent) / 2, bubbleText)
    }

    @SuppressLint("ClickableViewAccessibility")
    override fun onTouchEvent(e: MotionEvent): Boolean {
        // overlay では画面座標(raw)、stage では View 内座標で頭脳に渡す
        val wx = if (stage) e.x else e.rawX
        val wy = if (stage) e.y else e.rawY
        if (stage && e.actionMasked == MotionEvent.ACTION_DOWN) {
            // プレビューではペットの近くを触ったときだけ反応
            val inside = wx >= pet.x && wx <= pet.x + pet.win && wy >= pet.y && wy <= pet.y + pet.win
            if (!inside) return false
            parent?.requestDisallowInterceptTouchEvent(true)
        }
        val now = System.nanoTime()
        val dt = if (lastTouch == 0L) 0f else (now - lastTouch) / 1e9f
        lastTouch = now
        when (e.actionMasked) {
            MotionEvent.ACTION_DOWN -> { lastTouch = now; pet.touchDown(wx, wy) }
            MotionEvent.ACTION_MOVE -> pet.touchMove(wx, wy, dt)
            MotionEvent.ACTION_UP -> pet.touchUp()
            MotionEvent.ACTION_CANCEL -> pet.touchCancel()
        }
        return true
    }
}
