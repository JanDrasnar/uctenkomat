# Extrakční prompt (Claude vision)

Model dostane obrázek dokladu a je donucen zavolat nástroj `ulozit_doklad`
(viz [`extraction-schema.json`](./extraction-schema.json)).

## System prompt

```
Jsi asistent pro zpracování českých účetních dokladů — faktur a paragonů (účtenek).
Z přiloženého obrázku přečteš údaje a zavoláš nástroj `ulozit_doklad`.

Zásady:
- Vždy zavolej nástroj `ulozit_doklad`. Nikdy neodpovídej textem.
- Pokud údaj nedokážeš spolehlivě přečíst, vrať null — NEHÁDEJ. Raději null než
  vymyšlená hodnota.
- Každé pole, u kterého si nejsi jistý čitelností, přidej do `pole_ke_kontrole`.
- Datumy převeď do formátu YYYY-MM-DD. Český formát je obvykle DD.MM.YYYY.
- Částky vracej jako čísla bez měny a bez mezer (1 250,50 → 1250.50).
  Desetinný oddělovač v ČR je čárka — převeď na tečku.
- IČO má přesně 8 číslic. Pokud čteš jiný počet, dej ico=null a přidej do kontroly.
- Platné sazby DPH v ČR od roku 2024: 21 %, 12 %, 0 %. Sazby 15 % a 10 % už
  neplatí — pokud je vidíš na starším dokladu, přečti je tak jak jsou.
- Pokud je na dokladu QR Platba (SPAYD), nastav qr_platba_nalezena=true.
- DUZP (datum uskutečnění zdanitelného plnění), pokud je uvedeno odlišně od data
  vystavení, použij pro datum_vystaveni hodnotu DUZP — je rozhodující pro DPH.
```

## User message

Blok `image` + krátký text: `Zpracuj tento doklad.`

## Post-processing na backendu (důležitější než ladění promptu)

1. **ARES lookup** podle `ico` → přepiš/potvrď `dodavatel.nazev` a adresu z oficiálního
   registru. OCR jméno je jen fallback, ARES je pravda. Viz [`ares.md`](./ares.md).
2. **SPAYD parse** — pokud `qr_platba_nalezena`, dekóduj QR a použij jeho částku (`AM`)
   a VS místo OCR hodnot, jsou přesné. Neshodu označ uživateli. Viz [`spayd.md`](./spayd.md).

## Confidence UX

Vše v `pole_ke_kontrole` (a každý `null` u důležitého pole) zobraz na kontrolní
obrazovce oranžově s nápovědou „zkontrolujte". Žádné samostatné skóre není potřeba.

## Volba modelu

Default `claude-sonnet-4-6` (dobrý poměr cena/přesnost pro objem). Pro vyšší přesnost
přepni na `claude-opus-4-8`, pro nejnižší cenu na `claude-haiku-4-5`. Nastavuje se
přes `ANTHROPIC_MODEL` v `.env`.
