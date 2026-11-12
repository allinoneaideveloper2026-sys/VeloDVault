package com.allinoneaideveloper2026.velodvault;

import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.content.pm.SigningInfo;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginHandle;
import ee.forgr.capacitor.social.login.GoogleProvider;
import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;
import ee.forgr.capacitor.social.login.SocialLoginPlugin;
import java.security.MessageDigest;

public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Release builds: hide the screen in the app switcher and block screenshots.
        boolean debuggable = (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        if (!debuggable) {
            getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
        }
        // Lets the Setup check show this app's package name and signing fingerprint (public values Google asks for).
        try {
            getBridge().getWebView().addJavascriptInterface(new AppIdentity(), "VVNative");
        } catch (Exception e) {
            Log.i("VeloDVault", "Could not expose app identity");
        }
    }

    private static String hex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < bytes.length; i++) {
            if (i > 0) sb.append(':');
            sb.append(String.format("%02X", bytes[i]));
        }
        return sb.toString();
    }

    private class AppIdentity {
        @JavascriptInterface
        public String info() {
            try {
                PackageManager pm = getPackageManager();
                Signature[] sigs;
                if (Build.VERSION.SDK_INT >= 28) {
                    PackageInfo pi = pm.getPackageInfo(getPackageName(), PackageManager.GET_SIGNING_CERTIFICATES);
                    SigningInfo si = pi.signingInfo;
                    sigs = si.getApkContentsSigners();
                } else {
                    PackageInfo pi = pm.getPackageInfo(getPackageName(), PackageManager.GET_SIGNATURES);
                    sigs = pi.signatures;
                }
                byte[] cert = sigs[0].toByteArray();
                String sha1 = hex(MessageDigest.getInstance("SHA-1").digest(cert));
                String sha256 = hex(MessageDigest.getInstance("SHA-256").digest(cert));
                return "{\"pkg\":\"" + getPackageName() + "\",\"sha1\":\"" + sha1 + "\",\"sha256\":\"" + sha256 + "\"}";
            } catch (Exception e) {
                return "{\"error\":\"" + e.getClass().getSimpleName() + "\"}";
            }
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
