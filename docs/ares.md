# ARES — ověření IČO

ARES (Administrativní registr ekonomických subjektů, MF ČR) má veřejné REST API,
bez autentizace, zdarma.

## Endpoint

```
GET https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/{ico}
```

`{ico}` = 8 číslic.

## Odpověď (zkráceno)

```json
{
  "ico": "27082440",
  "obchodniJmeno": "Alza.cz a.s.",
  "sidlo": {
    "textovaAdresa": "Jankovcova 1522/53, Holešovice, 17000 Praha 7",
    "psc": 17000
  },
  "dic": "CZ27082440"
}
```

## Použití

Po extrakci zavoláme ARES s přečteným `ico`. Pokud subjekt existuje:
- `dodavatel.nazev` ← `obchodniJmeno` (přepíše OCR)
- doplníme adresu a potvrdíme `dic`

Pokud IČO neexistuje / nečitelné → ponecháme OCR hodnotu a označíme ke kontrole.

Implementace: [`backend/src/services/ares.js`](../backend/src/services/ares.js).

> Pozn.: ARES má i hromadné/vyhledávací endpointy (`/ekonomicke-subjekty/vyhledat`),
> pro náš případ stačí lookup podle konkrétního IČO.
