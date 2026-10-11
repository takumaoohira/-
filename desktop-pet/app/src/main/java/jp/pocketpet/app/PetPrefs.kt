package jp.pocketpet.app

import android.content.Context

/** 設定と、ペットの気分の保存先。 */
class PetPrefs(context: Context) {
    private val sp = context.getSharedPreferences("pet", Context.MODE_PRIVATE)

    var breedId: String
        get() = sp.getString("breed", Breeds.all[0].id)!!
        set(v) = sp.edit().putString("breed", v).apply()

    var name: String
        get() = sp.getString("name", "ミケ")!!
        set(v) = sp.edit().putString("name", v).apply()

    /** 0=小 1=中 2=大 */
    var size: Int
        get() = sp.getInt("size", 1)
        set(v) = sp.edit().putInt("size", v).apply()

    /** 0=おっとり 1=ふつう 2=げんき */
    var activity: Int
        get() = sp.getInt("activity", 1)
        set(v) = sp.edit().putInt("activity", v).apply()

    /** タッチを透過する(ペットがタップの邪魔をしない) */
    var ghost: Boolean
        get() = sp.getBoolean("ghost", false)
        set(v) = sp.edit().putBoolean("ghost", v).apply()

    var autostart: Boolean
        get() = sp.getBoolean("autostart", false)
        set(v) = sp.edit().putBoolean("autostart", v).apply()

    var running: Boolean
        get() = sp.getBoolean("running", false)
        set(v) = sp.edit().putBoolean("running", v).apply()

    val breed get() = Breeds.byId(breedId)

    fun petDp(): Float = when (size) { 0 -> 64f; 2 -> 104f; else -> 82f }

    fun activityFactor(): Float = when (activity) { 0 -> 0.65f; 2 -> 1.45f; else -> 1f }

    fun loadMood(pet: Pet) {
        pet.hunger = sp.getFloat("hunger", 30f)
        pet.energy = sp.getFloat("energy", 80f)
        pet.affection = sp.getFloat("affection", 60f)
        val saved = sp.getLong("savedAt", 0L)
        if (saved > 0L) pet.advanceOffline((System.currentTimeMillis() - saved) / 1000f)
    }

    fun saveMood(pet: Pet) {
        sp.edit()
            .putFloat("hunger", pet.hunger)
            .putFloat("energy", pet.energy)
            .putFloat("affection", pet.affection)
            .putLong("savedAt", System.currentTimeMillis())
            .apply()
    }
}
