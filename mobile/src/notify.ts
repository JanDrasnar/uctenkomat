// Lokální notifikace — informují uživatele, že doklad je zpracovaný/odeslaný,
// i když mezitím odešel z aplikace.
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

export async function initNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('doklady', {
      name: 'Zpracování dokladů',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const { granted } = await Notifications.getPermissionsAsync();
  if (!granted) await Notifications.requestPermissionsAsync();
}

export async function notify(title: string, body: string) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: Platform.OS === 'android' ? { channelId: 'doklady' } : null,
    });
  } catch {
    // notifikace nejsou kritické
  }
}
