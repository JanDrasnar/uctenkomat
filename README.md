# Účtenkomat

Mobilní aplikace (Android) pro OSVČ a s.r.o.: vyfoť účtenku nebo fakturu, AI z ní přečte
daňové údaje, zapíše je do **Google tabulky** (s odkazem na fotku na **Google Disku**)
a doklad pošle **účetní e‑mailem**. Hotové zpracování ohlásí notifikace.

> Český trh. Zaměřeno na **přijaté doklady** — paragony (účtenky) a faktury.

## Jak to funguje

Celé zpracování běží přímo v telefonu — bez vlastního serveru:

```
Vyfotit doklad
  → AI extrakce (Claude / OpenAI / Gemini — API klíč uživatele z Nastavení)
  → ověření dodavatele v ARES
  → fotka na Google Disk (složka „Účtenkomat“)
  → řádek v Google tabulce „Účtenkomat – doklady“ (odkaz na fotku)
  → e‑mail účetní z Gmailu uživatele (fotka v příloze + údaje v textu)
  → notifikace „Doklad zpracován a odeslán účetní ✓“
```

Po vyfocení se hned můžete vrátit k focení dalšího dokladu — zpracování běží na pozadí
a každý krok se ukládá, takže přerušené zpracování (zavřená aplikace, výpadek sítě)
se po návratu do aplikace dokončí. Chyby se dají zopakovat tlačítkem „Zkusit znovu“.

### Nastavení v aplikaci (⚙)

| Volba | Možnosti | Výchozí |
|---|---|---|
| E‑mail účetní | libovolná adresa | — |
| Odesílání dokladů | **Každý doklad hned** / Souhrnně za období (fotky + CSV jedním e‑mailem) | každý doklad hned |
| Účetní období | měsíc / čtvrtletí | čtvrtletí |
| AI pro čtení dokladů | Claude / OpenAI / Gemini + API klíč + model | Claude |
| Google účet | přihlášení vlastním Google účtem | — |

API klíče AI jsou uložené šifrovaně jen v telefonu (`expo-secure-store` → Android Keystore).
Každý uživatel se přihlašuje vlastním Google účtem a má vlastní tabulku i složku.

### Sloupce v Google tabulce

ID · Přidáno · Typ · Datum vystavení / DUZP · Splatnost · Číslo dokladu · Dodavatel · IČO · DIČ ·
Adresa · VS · Měna · Základ 21 % · DPH 21 % · Základ 12 % · DPH 12 % · Základ 0 % · Celkem ·
Ke kontrole · ARES ověřeno · Foto (odkaz na Disk) · Odesláno účetní · Období · AI ·
Tokeny vstup · Tokeny výstup · Cena AI (Kč)

**Náklady na AI** se měří z odpovědi poskytovatele (skutečné tokeny, u Gemini/OpenAI včetně
„přemýšlení“), cena se spočítá podle ceníku v `mobile/src/ai/pricing.ts` a přepočte denním
kurzem ČNB. Aplikace ukazuje cenu u každého dokladu a souhrn za aktuální měsíc; u Gemini
na free tieru jde o ceníkovou cenu, reálně se neplatí nic.

Sloupec **Foto** obsahuje přímý odkaz na fotku na Google Disku. Složku „Účtenkomat“
(fotky i tabulku) aplikace nasdílí účetní jen pro čtení — při uložení e‑mailu účetní
v Nastavení nebo nejpozději s prvním odeslaným dokladem. Google jí pošle pozvánku.

Oprava údajů v aplikaci přepíše příslušný řádek; u už odeslaného dokladu aplikace nabídne
poslat účetní opravu.

## Struktura repozitáře

```
uctenkomat/
├── mobile/      Expo (React Native + TypeScript) — aplikace, celé zpracování
│   └── src/
│       ├── ai/          extrakční schéma + volání Claude / OpenAI / Gemini
│       ├── google.ts    přihlášení, Drive, Sheets, Gmail
│       ├── pipeline.ts  zpracování dokladu krok po kroku, souhrnné odeslání
│       ├── store.ts     lokální seznam dokladů
│       └── notify.ts    notifikace
├── backend/     Původní Node.js backend (Railway) — aplikace ho už nepoužívá
└── docs/        Specifikace: extrakční schéma, prompt, ARES, SPAYD
```

## Zprovoznění

### 1. Google Cloud (jednou, cca 10 minut)

1. [console.cloud.google.com](https://console.cloud.google.com) → nový projekt.
2. **APIs & Services → Library** → zapnout **Google Drive API**, **Google Sheets API**, **Gmail API**.
3. **OAuth consent screen** → typ *External*, vyplnit název aplikace a e‑mail.
   Přidat scopes `.../auth/drive.file` a `.../auth/gmail.send`.
   Dokud je aplikace v režimu *Testing*, přidejte do **Test users** Google účty,
   které se budou přihlašovat (max. 100).
4. **Credentials → Create credentials → OAuth client ID → Android**:
   - Package name: `cz.uctenkomat.app`
   - SHA‑1: otisk podpisového klíče buildu — `eas credentials` (Android → Keystore)
     nebo `cd android && ./gradlew signingReport` u lokálního buildu.

`drive.file` vidí jen soubory, které aplikace sama vytvořila — ne celý Disk uživatele.
`gmail.send` umí jen odesílat, ne číst poštu. Pro veřejné vydání (nad 100 uživatelů)
Google u `gmail.send` vyžaduje ověření aplikace.

### 2. Testovací APK

GitHub Actions (`.github/workflows/android-apk.yml`) při každé změně v `mobile/` sestaví APK
a vystaví ho jako release **test-build**:
https://github.com/JanDrasnar/uctenkomat/releases/download/test-build/uctenkomat.apk
— stáhnout v telefonu a nainstalovat. Build je podepsaný debug klíčem z Expo šablony,
v kroku 4 výše použijte SHA‑1 `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`.

Lokální vývoj (aplikace kvůli Google přihlášení **neběží v Expo Go**):

```bash
cd mobile
npm install
npx expo run:android
```

### 3. V aplikaci — průvodce prvním spuštěním

Při prvním spuštění provede uživatele (i úplně netechnického) průvodce:

1. **Google účet** — jedno klepnutí „Přihlásit se Googlem“; hned se založí složka a tabulka.
2. **Účetní** — e‑mail a kdy posílat (každý doklad hned / za období). Složka se účetní rovnou nasdílí.
3. **Čtení dokladů (AI)** — výběr služby s doporučením (Gemini: zdarma, stačí Google účet;
   Claude / OpenAI: placený kredit). Pro každou službu očíslované kroky, tlačítko přímo na
   správnou stránku, **„Vložit zkopírovaný klíč“** jedním klepnutím, automatické rozpoznání
   služby podle klíče a **okamžité ověření** klíče i kreditu srozumitelnou češtinou.
4. **Hotovo** — shrnutí a „Vyfotit první doklad“.

Každý krok jde přeskočit a průvodce se dá spustit znovu v ⚙ Nastavení.

### Co musí udělat vydavatel aplikace (ne koncový uživatel)

Google Cloud projekt (krok 1 výše) zakládá jen vydavatel, jednou. Dokud je v režimu
*Testing*, musí být každý uživatel přidaný mezi **Test users** a při přihlášení uvidí
„Aplikace není ověřena“. Pro běžné uživatele je potřeba aplikaci u Googlu nechat
**ověřit** (OAuth verification — kvůli scope `gmail.send`: zásady ochrany soukromí,
video s ukázkou použití, pár dní až týdnů). Pak přihlášení proběhne bez varování
a bez limitu 100 uživatelů.

## Omezení / TODO

- [ ] QR Platba (SPAYD) se z obrázku nedekóduje přímo — AI jen hlásí, že na dokladu je.
      (Původní dekódování v `backend/src/services/qr.js`.)
- [ ] Android může zpracování na pozadí po delší době uspat — dokončí se po návratu do aplikace.
- [ ] iOS: doplnit `iosUrlScheme` pro Google Sign‑In plugin.
- [ ] Test na reálných vybledlých termopapírových účtenkách (Shell/Albert) — nejhorší případ.
