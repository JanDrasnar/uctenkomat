# Účtenkomat

Mobilní aplikace pro OSVČ a s.r.o.: vyfoť účtenku nebo fakturu, aplikace z ní přečte
údaje a na konci měsíce/čtvrtletí pošle účetní jeden balík (PDF + CSV) se všemi doklady.

> Český trh. Zaměřeno na **přijaté doklady** — paragony (účtenky) a faktury.
> Žádná hluboká integrace s účetním softwarem (Pohoda/Flexi) — zatím jen čistý handoff e‑mailem.

## Jak to funguje

```
Vyfotit doklad  →  Extrakce údajů (Claude vision)  →  Zkontrolovat/opravit
   →  Uloží se do aktuálního období  →  „Odeslat účetní" (PDF + CSV e‑mailem)
```

Doklad se podle **data vystavení** zařadí do správného období (měsíc nebo čtvrtletí).
Originální fotka se ukládá nezměněná (je to právní originál, archivace ~10 let).

## Struktura repozitáře (monorepo)

```
uctenkomat/
├── mobile/      Expo (React Native + TypeScript) — mobilní aplikace
├── backend/     Node.js + Express — extrakce, ARES, generování PDF/CSV, odeslání
└── docs/        Specifikace: extrakční schéma, prompt, ARES, SPAYD
```

## Rychlý start

### Backend
```bash
cd backend
cp .env.example .env        # doplň ANTHROPIC_API_KEY
npm install
npm run dev                 # http://localhost:3000
```

### Mobil
```bash
cd mobile
npm install
npx expo start              # naskenuj QR kód v Expo Go
```
V `mobile/src/api/client.ts` nastav `API_BASE_URL` na IP adresu počítače
s backendem (např. `http://192.168.1.10:3000`), aby na něj telefon dosáhl.

## Stav

MVP scaffold. Funkční kostra — viz `docs/` pro detaily extrakce a [TODO](#todo).

## TODO

- [ ] Dekódování QR Platby (SPAYD) přímo z obrázku (teď jen parser stringu — `backend/src/services/spayd.js`)
- [ ] Reálné odesílání e‑mailem přes SMTP (teď generuje soubory, e‑mail je volitelný)
- [ ] Trvalé úložiště (teď JSON soubor + lokální `uploads/`) → S3 + DB
- [ ] Autentizace uživatele
- [ ] Test na reálných vybledlých termopaprových účtenkách (Shell/Albert) — nejhorší případ
