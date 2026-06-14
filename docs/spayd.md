# SPAYD — QR Platba

QR Platba (standard SPAYD, Short Payment Descriptor) je český standard ČBA pro platební
QR kódy na fakturách. Je to prostý textový řetězec zakódovaný v QR.

## Formát

```
SPD*1.0*ACC:CZ5855000000001265098001*AM:1250.00*CC:CZK*X-VS:1234567890*MSG:Faktura 2026001
```

- `SPD` — hlavička, `1.0` verze
- pole oddělená `*`, klíč a hodnota dvojtečkou `KEY:VALUE`

| Klíč   | Význam                  |
|--------|-------------------------|
| ACC    | číslo účtu (IBAN)       |
| AM     | částka                  |
| CC     | měna                    |
| X-VS   | variabilní symbol       |
| X-KS   | konstantní symbol       |
| X-SS   | specifický symbol       |
| MSG    | zpráva pro příjemce     |
| DT     | datum splatnosti (YYYYMMDD) |

## Použití

Pokud doklad obsahuje QR Platbu, jsou její hodnoty **přesné** — použijeme `AM` a `X-VS`
přednostně před OCR. Neshoda mezi QR a OCR = signál k upozornění uživatele.

Parser řetězce: [`backend/src/services/spayd.js`](../backend/src/services/spayd.js).

## Dekódování z obrázku

Implementováno v [`backend/src/services/qr.js`](../backend/src/services/qr.js): `jimp` načte
pixely fotky, `jsqr` najde QR kód a `parseSpayd` ho rozparsuje. Při nahrání dokladu se
spustí automaticky — pokud QR existuje, jeho `AM` (částka) a `X-VS` přebijí OCR hodnoty
a případná neshoda se zaznamená do `poznamka_extrakce`.
