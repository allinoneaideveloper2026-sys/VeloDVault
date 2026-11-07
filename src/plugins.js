// Bundles the Capacitor plugins into one file the single-page app can use without a build system.
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { BiometricAuth } from '@aparajita/capacitor-biometric-auth';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { SocialLogin } from '@capgo/capacitor-social-login';

window.VVP = { Capacitor, LocalNotifications, BiometricAuth, SecureStorage, SocialLogin, native: Capacitor.isNativePlatform() };
