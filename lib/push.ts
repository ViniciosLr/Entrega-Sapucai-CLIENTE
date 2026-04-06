import Constants from 'expo-constants';
import { Platform } from 'react-native';

function isExpoGo() {
  return Constants.appOwnership === 'expo';
}

function getProjectId(): string | undefined {
  return (
    (Constants as any)?.expoConfig?.extra?.eas?.projectId ||
    (Constants as any)?.easConfig?.projectId ||
    (Constants as any)?.expoConfig?.extra?.projectId
  );
}

export async function registerForPushNotifications() {
  try {
    // Expo Go no Android não suporta push remoto
    if (Platform.OS === 'android' && isExpoGo()) {
      console.log(
        'Push remoto no Android foi removido do Expo Go (SDK 53+). Use Development Build.'
      );
      return null;
    }

    const Notifications = await import('expo-notifications');

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();

    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Usuário negou notificações');
      return null;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lockscreenVisibility:
          Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }

    const projectId = getProjectId();

    if (!projectId) {
      console.log('⚠️ projectId não encontrado em extra.eas.projectId');
      return null;
    }

    const token = (
      await Notifications.getExpoPushTokenAsync({ projectId })
    ).data;

    if (!token) {
      console.log('⚠️ Expo Push Token veio vazio');
      return null;
    }

    console.log('Expo Push Token:', token);
    return token;
  } catch (error) {
    console.error('Erro ao registrar push notification:', error);
    return null;
  }
}