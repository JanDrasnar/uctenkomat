// Nastavení aplikace. Běžné volby v AsyncStorage, API klíče AI zvlášť
// v šifrovaném úložišti (expo-secure-store → Android Keystore).
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

export type SendMode = 'per_photo' | 'per_period';
export type PeriodType = 'mesic' | 'ctvrtleti';
export type AiProvider = 'anthropic' | 'openai' | 'gemini';

export interface AppSettings {
  accountantEmail: string;
  /** Posílat účetní každý doklad hned, nebo souhrnně za období. */
  sendMode: SendMode;
  periodType: PeriodType;
  aiProvider: AiProvider;
  /** Model pro každého poskytovatele; prázdné = výchozí. */
  aiModels: Partial<Record<AiProvider, string>>;
  /** Průvodce prvním spuštěním dokončen. */
  onboarded: boolean;
}

export const AI_PROVIDERS: { id: AiProvider; label: string; defaultModel: string; keyHint: string }[] = [
  { id: 'anthropic', label: 'Claude', defaultModel: 'claude-sonnet-5', keyHint: 'sk-ant-…' },
  { id: 'openai', label: 'OpenAI', defaultModel: 'gpt-5-mini', keyHint: 'sk-…' },
  { id: 'gemini', label: 'Gemini', defaultModel: 'gemini-2.5-flash', keyHint: 'AIza…' },
];

export const DEFAULT_SETTINGS: AppSettings = {
  accountantEmail: '',
  sendMode: 'per_photo',
  periodType: 'ctvrtleti',
  aiProvider: 'anthropic',
  aiModels: {},
  onboarded: false,
};

const SETTINGS_KEY = 'uctenkomat.settings';
// Starší verze ukládala jen e-mail účetní pod tímto klíčem.
const LEGACY_EMAIL_KEY = 'uctenkomat.accountantEmail';

export async function getSettings(): Promise<AppSettings> {
  const raw = await AsyncStorage.getItem(SETTINGS_KEY);
  if (raw) {
    const saved = JSON.parse(raw);
    // Uživatelé z doby před průvodcem ho už nemusí procházet.
    if (saved.onboarded === undefined) saved.onboarded = !!saved.accountantEmail;
    return { ...DEFAULT_SETTINGS, ...saved };
  }
  const legacyEmail = (await AsyncStorage.getItem(LEGACY_EMAIL_KEY)) ?? '';
  return { ...DEFAULT_SETTINGS, accountantEmail: legacyEmail, onboarded: !!legacyEmail };
}

export async function saveSettings(s: AppSettings): Promise<void> {
  await AsyncStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({ ...s, accountantEmail: s.accountantEmail.trim() }),
  );
}

export function modelFor(s: AppSettings, provider: AiProvider = s.aiProvider): string {
  return s.aiModels[provider]?.trim()
    || AI_PROVIDERS.find((p) => p.id === provider)!.defaultModel;
}

const keyName = (p: AiProvider) => `uctenkomat.aikey.${p}`;

export async function getApiKey(p: AiProvider): Promise<string> {
  return (await SecureStore.getItemAsync(keyName(p))) ?? '';
}

export async function setApiKey(p: AiProvider, key: string): Promise<void> {
  const k = key.trim();
  if (k) await SecureStore.setItemAsync(keyName(p), k);
  else await SecureStore.deleteItemAsync(keyName(p));
}
