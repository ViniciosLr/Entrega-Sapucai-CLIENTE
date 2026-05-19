import 'dotenv/config';

const GOOGLE_MAPS_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

export default {
  expo: {
    name: "BoraRangar",
    slug: "santaritaentrega-cliente-",
    version: "5.05.19",
    orientation: "portrait",

    // ÍCONE DO APP
    icon: "./assets/images/adaptive-icon.png",

    scheme: "familiamotoboy",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,

    splash: {
      image: "./assets/images/icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },

    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.seuusuario.sapucaientrega",
      config: {
        googleMapsApiKey: GOOGLE_MAPS_API_KEY
      }
    },

    android: {
      package: "com.seuusuario.sapucaientrega",
      versionCode: 2126,

      permissions: [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "POST_NOTIFICATIONS"
      ],

      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },

      config: {
        googleMaps: {
          apiKey: GOOGLE_MAPS_API_KEY
        }
      }
    },

    plugins: [
      "expo-router",
      "expo-font",
      "expo-web-browser",

      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission:
            "Permitir que o app use sua localização para entregas."
        }
      ],

      [
        "expo-notifications",
        {
          icon: "./assets/images/notification-icon.png",
          color: "#ffffff",
          useNextNotificationsApi: true
        }
      ]
    ],

    extra: {
      eas: {
        projectId: "6465ed38-8300-4325-938a-175a814dbba1"
      }
    },

    owner: "pablo095"
  }
};
