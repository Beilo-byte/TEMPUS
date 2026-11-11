# TEMPUS

Compte enrere visual per a classe, fet només amb HTML, CSS i JavaScript. No necessita comptes, biblioteques ni serveis externs.

## Què inclou

- Durada lliure o botons ràpids d'1, 2, 5 i 15 minuts.
- Rellotge educatiu amb 60 marques, tres agulles i lectura digital sincronitzada.
- Fons de vídeo, 24 fotografies en seqüència o fitxers propis. El progrés del fons s'adapta a la durada escollida; la pausa congela el rellotge i la imatge.
- Quatre aparences: quadern, fusta, editorial i fosca. Vistes Taula i Projecció, més pantalla completa.
- Marques il·limitades amb nom, ordre d'arribada o rànquing per temps transcorregut i exportació CSV.

Els noms de les marques es mantenen en aquesta pestanya del navegador. No s'envien a cap servidor. Exporta el CSV abans de tancar la pestanya si els vols conservar.

## Obrir i publicar

La versió pública és [beilo-byte.github.io/TEMPUS](https://beilo-byte.github.io/TEMPUS/). Aquest repositori ja conté `index.html`, `app.js`, `style.css` i `assets/` a l'arrel, amb GitHub Pages configurat a `main` i **/(root)**. Si fas servir el ZIP en un altre repositori, extreu-lo i puja'n tot el contingut a l'arrel. No hi ha cap pas de compilació.

## Executar en local

Des de la carpeta que conté `index.html`, inicia un servidor estàtic; per exemple:

```sh
python3 -m http.server 8000
```

Obre `http://localhost:8000` al navegador. Obrir `index.html` directament com a fitxer pot impedir la càrrega del manifest dels fons per les restriccions del navegador.

## Funcionament del temps

El compte es calcula contra un instant límit de `performance.now()`, de manera que continua sent precís encara que la pestanya perdi el focus. Les tres agulles mostren el **temps restant** i retrocedeixen cap a les 12. Cada marca desa el temps **transcorregut** exacte en el moment del clic. El vídeo recorre el seu principi i final dins de la durada triada.
