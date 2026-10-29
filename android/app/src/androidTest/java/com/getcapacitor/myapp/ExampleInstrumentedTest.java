package com.getcapacitor.myapp;

import static org.junit.Assert.*;

import android.content.Context;
import android.content.pm.ActivityInfo;
import android.content.pm.ApplicationInfo;
import android.content.ComponentName;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;

/**
 * Instrumented test, which will execute on an Android device.
 *
 * @see <a href="http://d.android.com/tools/testing">Testing documentation</a>
 */
@RunWith(AndroidJUnit4.class)
public class ExampleInstrumentedTest {

    @Test
    public void useAppContext() throws Exception {
        // Context of the app under test.
        Context appContext = InstrumentationRegistry.getInstrumentation().getTargetContext();

        assertEquals("com.maxnjun.burgundyexpanded", appContext.getPackageName());
        assertEquals(0, appContext.getApplicationInfo().flags & ApplicationInfo.FLAG_ALLOW_BACKUP);
        ActivityInfo activity = appContext.getPackageManager().getActivityInfo(
            new ComponentName(appContext, "com.maxnjun.burgundyexpanded.MainActivity"), 0);
        assertEquals(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE, activity.screenOrientation);
    }

    @Test
    public void offlineAssetsArePackaged() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        for (String file : new String[]{"public/index.html", "public/online/index.html",
                "public/tiles/castle.png", "public/assets/icons/worker.png", "public/android-build.json"}) {
            try (java.io.InputStream input = context.getAssets().open(file)) {
                assertTrue("Missing bundled asset: " + file, input.read() != -1);
            }
        }
    }
}
