export type TypDokladu = 'faktura' | 'paragon' | 'neurceno';

export interface DphRadek {
  sazba: 21 | 12 | 0;
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
  variabilni_symbol?: string | null;
  mena: string;
  castka_celkem: number | null;
  dph_rozpis: DphRadek[];
  qr_platba_nalezena: boolean;
  pole_ke_kontrole: string[];
  poznamka_extrakce?: string | null;
  ares_overeno?: boolean;
}

export interface Doklad {
  id: string;
  imageUrl: string;
  period: string;
  reviewed: boolean;
  createdAt: string;
  data: DokladData;
}

export interface PeriodSummary {
  period: string;
  count: number;
  total: number;
  sent: boolean;
}
