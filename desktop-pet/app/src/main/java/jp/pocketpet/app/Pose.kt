package jp.pocketpet.app

enum class Posture { STAND, SIT, LIE, CURL, STRETCH, DANGLE, AIR }
enum class Eyes { OPEN, BLINK, HAPPY, SLEEP, WIDE, DIZZY, HALF, HEART }
enum class Mouth { NONE, SMILE, OPEN, CHEW, TONGUE, PANT }

/**
 * 1フレーム分の姿勢。Pet(頭脳)が毎フレーム組み立て、PetRenderer(描画)が読む。
 * 座標単位は「ペット1匹 ≒ 幅100」の仮想単位で、足元が y=0、上がマイナス。
 */
class Pose {
    var posture = Posture.STAND
    var walkPhase = 0f      // 歩行サイクル(ラジアン)
    var walkAmp = 0f        // 0=静止 1=しっかり歩く
    var bob = 0f            // 体の上下(マイナスで上)
    var hop = 0f            // 全体のジャンプ量(マイナスで上)
    var squash = 1f         // 縦のつぶれ(着地など)
    var bodyTilt = 0f       // 体の傾き(度)
    var headTilt = 0f       // 首かしげ(度)
    var headDx = 0f
    var headDy = 0f
    var look = 1f           // 視線 -1(後ろ)〜1(前)
    var eyes = Eyes.OPEN
    var mouth = Mouth.SMILE
    var chew = 0f           // もぐもぐ 0..1
    var tailAngle = 0f      // しっぽ振り(度)
    var earFlick = 0f       // 耳ぴくっ 0..1
    var blush = false
    var pawUp = 0f          // 前足を上げる 0..1
    var swing = 0f          // つままれ時の揺れ(度)
    var breathe = 0f        // 呼吸 -1..1

    fun reset() {
        posture = Posture.STAND
        walkPhase = 0f; walkAmp = 0f; bob = 0f; hop = 0f; squash = 1f
        bodyTilt = 0f; headTilt = 0f; headDx = 0f; headDy = 0f; look = 1f
        eyes = Eyes.OPEN; mouth = Mouth.SMILE; chew = 0f
        tailAngle = 0f; earFlick = 0f; blush = false; pawUp = 0f; swing = 0f; breathe = 0f
    }
}
