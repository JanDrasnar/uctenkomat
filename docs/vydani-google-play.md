# Vydání na Google Play (osobní vývojářský účet)

Pořadí: **A** klíč a první build → **B** Play Console a uzavřený test (14 dní) →
**C** ověření aplikace u Googlu (běží souběžně s B) → **D** produkce.

Kde je v textu `[DOPLNIT]`, doplňte vlastní údaj.

---

## A. Upload klíč a první podepsaný build

### A1. Vytvořit upload klíč (5 minut, v prohlížeči)

Nejjednodušší je Google Cloud Shell — terminál v prohlížeči, nic se neinstaluje:

1. Otevřete [console.cloud.google.com](https://console.cloud.google.com) a vpravo nahoře klikněte na ikonu **>_** (Activate Cloud Shell).
2. Vložte a spusťte (zeptá se na heslo — **zapište si ho**, budete ho potřebovat dvakrát):

   ```bash
   keytool -genkeypair -v -keystore upload.jks -alias upload -keyalg RSA -keysize 2048 \
     -validity 10000 -dname "CN=Uctenkomat"
   base64 -w0 upload.jks > upload.b64 && echo && cat upload.b64 && echo
   keytool -list -v -keystore upload.jks -alias upload | grep SHA1
   cloudshell download upload.jks
   ```

3. Soubor `upload.jks`, který se stáhne, a heslo **uložte bezpečně** (správce hesel). Při ztrátě
   jde klíč přes podporu Google Play vyměnit, ale je to zdržení.

### A2. Uložit klíč do GitHubu

GitHub → repozitář → **Settings → Secrets and variables → Actions → New repository secret**:

| Název | Hodnota |
|---|---|
| `UPLOAD_KEYSTORE_BASE64` | dlouhý text vypsaný příkazem `cat upload.b64` |
| `UPLOAD_KEYSTORE_PASSWORD` | heslo z A1 |
| `UPLOAD_KEY_ALIAS` | `upload` |
| `UPLOAD_KEY_PASSWORD` | heslo z A1 (keytool použije stejné) |

### A3. Sestavit App Bundle

1. Sloučit větev s aplikací do `main` (ruční workflow jde spustit jen z výchozí větve).
2. GitHub → **Actions → Android release → Run workflow**.
3. Po doběhnutí (~10 min) je ve výsledku ke stažení `uctenkomat-N.aab` a v souhrnu **SHA‑1 upload klíče**.

### A4. Google Cloud: přihlášení Googlem pro verzi z Play

Google Play aplikaci znovu podepisuje vlastním klíčem, proto potřebuje Google Cloud znát
**dva další otisky**. Pro každý z nich: **APIs & Services → Credentials → Create credentials →
OAuth client ID → Android**, package `cz.uctenkomat.app`:

1. SHA‑1 **upload klíče** (z A1 nebo ze souhrnu buildu),
2. SHA‑1 **klíče pro podepisování aplikací od Googlu** — objeví se po prvním nahrání buildu
   v Play Console: **Test and release → Setup → App integrity → App signing**.

Stávající klient s testovacím SHA‑1 `5E:8F:…:F6:25` nechte — používá ho testovací APK.

---

## B. Google Play Console

### B1. Účet (jednou)

[play.google.com/console](https://play.google.com/console) → osobní účet, poplatek 25 USD,
ověření totožnosti (doklad + telefon). Ověření trvá obvykle 1–3 dny.

### B2. Vytvořit aplikaci

**Create app** → název *Účtenkomat*, výchozí jazyk *čeština*, *App*, *Free*.

### B3. App content (vše v levém menu *Policy → App content*)

- **Privacy policy:** `https://jandrasnar.github.io/uctenkomat/ochrana-soukromi.html`
- **App access:** *All or some functionality is restricted* → přidat instrukce:
  > Sign in with the Google test account below. On the AI step choose Gemini and paste the API key below (or tap Skip). Then take a photo of any receipt.
  > Google account: `[DOPLNIT testovací účet]` / heslo `[DOPLNIT]` · Gemini API key: `[DOPLNIT]`

  Testovací Google účet přidejte mezi *Test users* v Google Cloud.
- **Ads:** No ads.
- **Content rating:** dotazník → kategorie *Utility / Productivity*, všude „No“.
- **Target audience:** 18+.
- **Data safety:** viz tabulka níže.
- **Financial features:** aplikace nenabízí finanční služby → *None*.
- **Government apps / News:** No.

### B4. Uzavřený test — povinně 12 testerů po 14 dní

1. **Test and release → Testing → Closed testing → Create track**.
2. **Testers:** e‑mailový seznam alespoň **12 lidí** (Google účty). Stejné účty přidejte v Google Cloud do *Test users* (dokud aplikace není ověřená, viz C).
3. **Create release** → nahrát `uctenkomat-N.aab` z A3 → poznámky k verzi → *Review and roll out*.
4. Testerům pošlete **opt‑in odkaz** (je v nastavení tracku). Každý musí odkaz otevřít, přihlásit se k testu a aplikaci nainstalovat z Play.
5. Aspoň 12 testerů musí zůstat přihlášených **14 dní v kuse**. Požádejte je, ať aplikaci opravdu používají — Google se na to ptá.

Nové verze během testu: znovu *Run workflow* (versionCode se zvýší sám) a nahrát nový `.aab`.

### B5. Žádost o produkci

Po 14 dnech: **Dashboard → Apply for production** → dotazník o průběhu testu → kontrola
Googlem (obvykle do 7 dní) → **Production → Create release** se stejným `.aab`.

---

## C. Ověření aplikace u Googlu (OAuth verification)

Kvůli oprávnění `gmail.send`. Do ověření platí limit 100 uživatelů (jen *Test users*)
a při přihlášení se zobrazuje „Aplikace není ověřena“.

1. **GitHub Pages:** repozitář → *Settings → Pages* → *Deploy from a branch* → `main` / `/docs`.
   Web pak běží na `https://jandrasnar.github.io/uctenkomat/`.
2. **Vlastnictví domény:** [Google Search Console](https://search.google.com/search-console) →
   *Add property* → *URL prefix* `https://jandrasnar.github.io/uctenkomat/` → metoda *HTML tag*.
   Pošlete mi meta tag, vložím ho do `docs/index.html`.
   (Časem je lepší vlastní doména, např. `uctenkomat.cz` — stačí přepnout adresy.)
3. **Google Cloud → OAuth consent screen / Branding:**
   - App name *Účtenkomat*, logo 120×120 px, support e‑mail
   - Home page `https://jandrasnar.github.io/uctenkomat/`
   - Privacy policy `https://jandrasnar.github.io/uctenkomat/privacy.html`
   - Authorized domain `jandrasnar.github.io`
4. **Audience → Publish app** (stav *In production*) → **Prepare for verification**.
5. **Zdůvodnění oprávnění** (anglicky):
   - `drive.file`: *The app creates a folder and a spreadsheet in the user's Google Drive, uploads photos of receipts the user takes, and writes the data read from them into the spreadsheet. It only accesses files it created. At the user's request it shares the folder with their accountant.*
   - `gmail.send`: *The app e‑mails each receipt photo with its extracted details to the accountant address the user enters in the app, from the user's own Gmail so the accountant can reply to them. It never reads, modifies or deletes mail.*
6. **Demo video** (YouTube, může být *Unlisted*, 2–3 min, anglické titulky stačí):
   přihlášení Googlem s viditelnou obrazovkou souhlasu, vyfocení dokladu, soubor na Disku,
   řádek v tabulce, odeslaný e‑mail v Gmailu (složka Odeslané).
7. Odeslat. Google se obvykle ozve do několika dnů, celé ověření trvá dny až týdny.

---

## Texty pro Google Play

**Název:** Účtenkomat

**Krátký popis (max. 80 znaků):**
> Vyfoťte účtenku – AI přečte údaje, uloží je do Google tabulky a pošle účetní.

**Dlouhý popis:**
> Účtenkomat ušetří OSVČ a malým firmám papírování s doklady.
>
> Vyfotíte účtenku nebo fakturu a aplikace:
> • přečte údaje pro daně – dodavatele, IČO, DIČ, datum vystavení / DUZP, částky a rozpis DPH,
> • ověří dodavatele v registru ARES,
> • uloží fotku na váš Google Disk a údaje do Google tabulky,
> • pošle doklad vaší účetní e‑mailem – každý hned, nebo souhrnně za měsíc či čtvrtletí.
>
> Po vyfocení můžete hned fotit další doklad, o dokončení vás upozorní notifikace.
>
> Vaše data zůstávají u vás: aplikace nemá vlastní server, doklady ukládá do vašeho Google účtu.
> Čtení dokladů obstarává AI služba podle vašeho výběru – Google Gemini (zdarma), Claude nebo OpenAI – s vaším vlastním klíčem. Průvodce vás nastavením provede krok za krokem.
>
> Pro firmy: více kolegů může ukládat doklady do jedné společné tabulky a složky.

**Kategorie:** Business (Firmy) · **Kontakt:** `[DOPLNIT e‑mail]`

**Grafika:** ikona 512×512, feature graphic 1024×500, aspoň 2 snímky obrazovky telefonu.

---

## Data safety (návrh odpovědí)

- *Does your app collect or share any of the required user data types?* **Yes**
- *Is all user data encrypted in transit?* **Yes**
- *Do you provide a way for users to request that their data is deleted?* **Yes** (data jsou v jejich Google účtu; odinstalace maže data v telefonu)

| Typ dat | Collected | Shared | Účel | Povinné |
|---|---|---|---|---|
| Personal info → Name, Email address | ano | ne | App functionality, Account management | ano |
| Financial info → Purchase history / Other financial info (údaje z dokladů) | ano | ano (zvolená AI služba) | App functionality | ano |
| Photos and videos → Photos (fotky dokladů) | ano | ano (zvolená AI služba) | App functionality | ano |
| Messages → Emails (odeslání účetní) | ano | ne | App functionality | ne (lze vypnout odesílání) |

Data se nezpracovávají pro reklamu ani analytiku. „Collected“ zde znamená, že data opouštějí
telefon (Google Disk/Gmail uživatele, AI služba) — provozovatel sám žádná data nemá.
