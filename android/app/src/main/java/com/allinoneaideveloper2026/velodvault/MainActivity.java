package com.allinoneaideveloper2026.velodvault;

import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.os.Bundle;
import android.util.Log;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginHandle;
import ee.forgr.capacitor.social.login.GoogleProvider;
import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;
import ee.forgr.capacitor.social.login.SocialLoginPlugin;

public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Release builds: hide the screen in the app switcher and block screenshots.
        boolean debuggable = (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        if (!debuggable) {
            getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
        }
    }

    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode >= GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MIN.intValue()
                && requestCode < GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MAX.intValue()) {
            PluginHandle handle = getBridge().getPlugin("SocialLogin");
            if (handle == null) {
                Log.i("VeloDVault", "SocialLogin plugin handle is null");
                return;
            }
            Plugin plugin = handle.getInstance();
            if (!(plugin instanceof SocialLoginPlugin)) {
                Log.i("VeloDVault", "Plugin is not SocialLoginPlugin");
                return;
            }
            ((SocialLoginPlugin) plugin).handleGoogleLoginIntent(requestCode, data);
        }
    }

    public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {}
}
