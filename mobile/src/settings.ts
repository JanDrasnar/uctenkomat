// Lokální nastavení aplikace (uložené na zařízení přes AsyncStorage).
import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCOUNTANT_EMAIL_KEY = 'uctenkomat.accountantEmail';

export async function getAccountantEmail(): Promise<string> {
  return (await AsyncStorage.getItem(ACCOUNTANT_EMAIL_KEY)) ?? '';
}

export async function setAccountantEmail(email: string): Promise<void> {
  await AsyncStorage.setItem(ACCOUNTANT_EMAIL_KEY, email.trim());
}
