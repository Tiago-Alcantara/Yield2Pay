import type { ConfigContext, ExpoConfig } from 'expo/config';

const host = process.env.EXPO_PUBLIC_ASSOCIATED_HOST || 'yield2pay.app';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Yield2Pay',
  slug: 'yield2pay',
  scheme: 'yield2pay',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  backgroundColor: '#0c0d0f',
  ios: {
    bundleIdentifier: 'com.yield2pay.app',
    supportsTablet: false,
    associatedDomains: [`applinks:${host}`],
    infoPlist: {
      NSFaceIDUsageDescription:
        'O Yield2Pay usa o Face ID para abrir o app e autorizar depósitos e saques.',
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'com.yield2pay.app',
    adaptiveIcon: {
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
      backgroundColor: '#0c0d0f',
    },
    predictiveBackGestureEnabled: false,
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          { scheme: 'https', host, pathPrefix: '/deposito' },
          { scheme: 'https', host, pathPrefix: '/saque' },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#0c0d0f',
        image: './assets/splash-icon.png',
        resizeMode: 'contain',
        imageWidth: 200,
      },
    ],
    'expo-secure-store',
    'expo-web-browser',
    'expo-apple-authentication',
    'expo-local-authentication',
    [
      'expo-build-properties',
      {
        ios: { deploymentTarget: '16.4' },
        android: { minSdkVersion: 26 },
      },
    ],
  ],
  experiments: {
    typedRoutes: false,
  },
  extra: {
    privyAppId: process.env.EXPO_PUBLIC_PRIVY_APP_ID ?? '',
    privyClientId: process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID ?? '',
    router: {},
    eas: {},
  },
});
