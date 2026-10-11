package jp.pocketpet.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Settings

/** 端末の起動時に、前回出していたペットを自動で出す(設定でONのときだけ)。 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        val prefs = PetPrefs(context)
        if (prefs.autostart && prefs.running && Settings.canDrawOverlays(context)) {
            runCatching { PetService.send(context, PetService.ACTION_START) }
        }
    }
}
