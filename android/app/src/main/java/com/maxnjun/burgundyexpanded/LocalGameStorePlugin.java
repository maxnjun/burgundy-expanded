package com.maxnjun.burgundyexpanded;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import android.content.Context;

@CapacitorPlugin(name = "LocalGameStore")
public class LocalGameStorePlugin extends Plugin {
    @PluginMethod public void read(PluginCall call) {
        JSObject result = new JSObject();
        android.content.SharedPreferences prefs = getContext().getSharedPreferences("local-game", Context.MODE_PRIVATE);
        result.put("text", prefs.getString("active", null));
        result.put("history", prefs.getString("history", null));
        call.resolve(result);
    }
    @PluginMethod public void write(PluginCall call) {
        String save = call.getString("text"), history = call.getString("history");
        if (save == null || save.length() > 6000000 || history == null || history.length() > 4000000) { call.reject("Invalid local save size"); return; }
        // Acknowledge only after Android has committed the new game to private storage.
        if (!getContext().getSharedPreferences("local-game", Context.MODE_PRIVATE).edit().putString("active", save).putString("history", history).commit()) {
            call.reject("Local game could not be committed"); return;
        }
        call.resolve();
    }
}
