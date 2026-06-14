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

## TODO: dekódování z obrázku

Teď máme jen parser řetězce. Dekódování QR z fotky vyžaduje načíst pixely a QR čtečku
(např. `jimp` + `jsqr`). Krok navíc oproti MVP — proto zatím model jen příznakem
`qr_platba_nalezena` říká, že tam QR je, a parser je připraven na string.
