import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

function getExpoProjectId(): string | undefined {
  const id1 = (Constants as any)?.expoConfig?.extra?.eas?.projectId;
  const id2 = (Constants as any)?.easConfig?.projectId;
  const id3 = (Constants as any)?.expoConfig?.extra?.projectId;

  console.log('projectId id1:', id1);
  console.log('projectId id2:', id2);
  console.log('projectId id3:', id3);

  return id1 || id2 || id3;
}

async function getNotificationsModule() {
  if (Platform.OS === 'android' && isExpoGo()) {
    console.log('Android + Expo Go: push remoto bloqueado');
    return null;
  }

  const Notifications = await import('expo-notifications');

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  return Notifications;
}

async function ensureNotificationPermission(
  Notifications: any
): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  console.log('Permissão atual:', existing);

  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  console.log('Permissão depois de pedir:', status);

  return status === 'granted';
}

export const notificationService = {
  async getExpoPushToken(): Promise<string | null> {
    try {
      console.log('=== PUSH DEBUG ===');
      console.log('Platform:', Platform.OS);
      console.log('appOwnership:', Constants.appOwnership);
      console.log('Device.isDevice:', Device.isDevice);
      console.log('expoConfig.extra:', (Constants as any)?.expoConfig?.extra);
      console.log('easConfig:', (Constants as any)?.easConfig);

      const Notifications = await getNotificationsModule();
      if (!Notifications) {
        console.log('Notifications module não carregado');
        return null;
      }

      if (!Device.isDevice) {
        console.log('PushToken: precisa de aparelho físico');
        return null;
      }

      const granted = await ensureNotificationPermission(Notifications);
      if (!granted) {
        console.log('PushToken: permissão negada');
        return null;
      }

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }

      const projectId = getExpoProjectId();
      console.log('projectId final:', projectId);

      if (!projectId) {
        console.log('PushToken: projectId não encontrado');
        return null;
      }

      const tokenResponse = await Notifications.getExpoPushTokenAsync({
        projectId,
      });

      console.log('tokenResponse:', tokenResponse);

      return tokenResponse?.data ?? null;
    } catch (err) {
      console.error('Erro getExpoPushToken:', err);
      return null;
    }
  },
};