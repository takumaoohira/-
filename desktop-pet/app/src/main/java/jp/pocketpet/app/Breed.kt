package jp.pocketpet.app

enum class Species { CAT, DOG }
enum class EarType { CAT, UP, FLOPPY }
enum class TailType { LONG, CURL, WAG }
enum class Pattern { NONE, STRIPES, CALICO, SADDLE, POINT }

/** 見た目の定義。すべてコードで描画するので画像素材は不要。 */
data class Breed(
    val id: String,
    val label: String,
    val species: Species,
    val base: Int,
    val belly: Int,
    val patch: Int,
    val pattern: Pattern,
    val ear: EarType,
    val tail: TailType,
    val eye: Int,
    val outline: Int,
)

private fun c(v: Long) = v.toInt()

object Breeds {
    val all = listOf(
        Breed("cat_orange", "茶トラ", Species.CAT, c(0xFFF4A95E), c(0xFFFFF3E0), c(0xFFD9822B),
            Pattern.STRIPES, EarType.CAT, TailType.LONG, c(0xFF7FB547), c(0xFF8A4F1F)),
        Breed("cat_black", "黒猫", Species.CAT, c(0xFF36313B), c(0xFF45404B), c(0xFF36313B),
            Pattern.NONE, EarType.CAT, TailType.LONG, c(0xFFF5C518), c(0xFF151217)),
        Breed("cat_white", "白猫", Species.CAT, c(0xFFFCFBF8), c(0xFFFFFFFF), c(0xFFE9E4DC),
            Pattern.NONE, EarType.CAT, TailType.LONG, c(0xFF5BB6E0), c(0xFF9C948A)),
        Breed("cat_calico", "三毛猫", Species.CAT, c(0xFFFFFDF8), c(0xFFFFFFFF), c(0xFFEB9440),
            Pattern.CALICO, EarType.CAT, TailType.LONG, c(0xFFC9A227), c(0xFF8C7B6B)),
        Breed("cat_gray", "サバトラ", Species.CAT, c(0xFFA3A9B1), c(0xFFEFF1F3), c(0xFF5E646C),
            Pattern.STRIPES, EarType.CAT, TailType.LONG, c(0xFF8DBF4E), c(0xFF4B5057)),
        Breed("dog_shiba", "柴犬", Species.DOG, c(0xFFE0904B), c(0xFFFFF5E6), c(0xFFE0904B),
            Pattern.NONE, EarType.UP, TailType.CURL, c(0xFF3A2618), c(0xFF8C4E1F)),
        Breed("dog_kuroshiba", "黒柴", Species.DOG, c(0xFF33302F), c(0xFFF7E9D6), c(0xFFD49A5C),
            Pattern.POINT, EarType.UP, TailType.CURL, c(0xFF1B1514), c(0xFF141111)),
        Breed("dog_beagle", "ビーグル", Species.DOG, c(0xFFC07C3E), c(0xFFFFFFFF), c(0xFF2E2826),
            Pattern.SADDLE, EarType.FLOPPY, TailType.WAG, c(0xFF3A2618), c(0xFF6B3F1A)),
        Breed("dog_golden", "ゴールデン", Species.DOG, c(0xFFEDBE6E), c(0xFFFBE6BC), c(0xFFD9A24E),
            Pattern.NONE, EarType.FLOPPY, TailType.WAG, c(0xFF3A2618), c(0xFF9A6A25)),
        Breed("dog_white", "白いわんこ", Species.DOG, c(0xFFFFFFFF), c(0xFFFFFFFF), c(0xFFF1ECE4),
            Pattern.NONE, EarType.FLOPPY, TailType.WAG, c(0xFF1F1A18), c(0xFFA29A90)),
    )

    fun byId(id: String?): Breed = all.firstOrNull { it.id == id } ?: all[0]
}
