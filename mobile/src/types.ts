export type TypDokladu = 'faktura' | 'paragon' | 'neurceno';

export interface DphRadek {
  sazba: number;
  zaklad: number;
  dph: number;
}

export interface DokladData {
  typ_dokladu: TypDokladu;
  dodavatel: {
    nazev: string | null;
    ico: string | null;
    dic: string | null;
    adresa?: string | null;
  };
  datum_vystaveni: string | null;
  datum_splatnosti?: string | null;
  cislo_dokladu?: string | null;
  variabilni_symbol?: string | null;
  mena: string;
  castka_celkem: number | null;
  dph_rozpis: DphRadek[];
  qr_platba_nalezena: boolean;
  pole_ke_kontrole: string[];
  poznamka_extrakce?: string | null;
  ares_overeno?: boolean;
}

/** Stav zpracování dokladu v telefonu. */
export type DokladStatus = 'zpracovava' | 'hotovo' | 'chyba';

export interface Doklad {
  id: string;
  createdAt: string;
  /** Originální fotka uložená v dokumentech aplikace. */
  photoUri: string;
  photoWidth?: number;
  photoHeight?: number;
  status: DokladStatus;
  /** Popis aktuálního kroku při zpracování (pro UI). */
  step?: string;
  error?: string;
  period: string;
  /** Vyplní AI; null dokud extrakce neproběhla. */
  data: DokladData | null;
  aiProvider?: string;
  /** Skutečná spotřeba AI podle odpovědi poskytovatele. */
  aiUsage?: {
    inputTokens: number;
    outputTokens: number;
    /** null = model není v ceníku (src/ai/pricing.ts) */
    costUsd: number | null;
    costCzk: number | null;
    /** kurz ČNB použitý pro přepočet */
    usdCzk: number;
  };
  driveFileId?: string;
  driveLink?: string;
  /** Číslo řádku v Google tabulce (1 = hlavička). */
  sheetRow?: number;
  /** Tabulka, do které byl řádek zapsán (osobní nebo firemní). */
  sheetId?: string;
  sentAt?: string;
  reviewed: boolean;
}
