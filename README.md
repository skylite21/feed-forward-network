# Interaktív Feed Forward Háló

Ez az egyoldalas demó egy előrecsatolt neurális háló vizuális felületét mutatja be. A bemenetek keverhetőek, a rejtett neuronkörök súlyai állíthatók, a kimenet finomhangolható, és a kapcsolatvonalak erőssége az áttetszőségen keresztül jelenik meg.

## Helyi futtatás
1. Klónozd a repót és lépj be a könyvtárába.
2. Nyisd meg az `index.html` fájlt közvetlenül (`xdg-open index.html`), vagy indíts egyszerű szervert: `python3 -m http.server 5173`.
3. Böngészőben frissítsd a súlyokat és figyeld a háló reakcióját.

## Állatképek (macska/kutya)
- A demó helyi képeket használ az `assets/pets/` könyvtárból (10 macska + 10 kutya).
- Új képkészlet letöltése/generálása: `python3 scripts/fetch-pet-images.py`
- Ha letöltés közben hiba történik, véletlenszerűen a `assets/pets/fallback/` képeit használja a script.

## GitHub Pages publikálás
1. Győződj meg róla, hogy a változtatások a `master` ágon commitolva és a `github` távolihoz pusholva vannak.
2. Frissítsd a Pages ágat: `git checkout gh-pages && git merge master && git push github gh-pages`.
3. A weboldal a https://skylite21.github.io/feed-forwad-network/ címen frissül, miután a GitHub Pages build lefutott.
