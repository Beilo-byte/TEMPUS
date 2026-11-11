# TEMPUS · Registre de construcció i proves

## Mètode

Aplicació estàtica pròpia en HTML, CSS i JavaScript, publicada a GitHub Pages. El compte enrere calcula el temps restant amb `performance.now()`; no depèn del nombre de fotogrames ni d'un comptador que resti un segon cada vegada. Les posicions de les agulles són capes SVG independents: 60 de segonera, 60 de minutera i 720 d'horària. El fitxer `positions.json` les empaqueta per servir-les fàcilment a GitHub; el ZIP conserva també els SVG separats.

El progrés del vídeo o de les 24 fotografies es calcula amb la fracció de temps transcorregut. Així, començar, pausar, reprendre i arribar a zero mouen el fons i les agulles d'acord amb el mateix temps. Els vídeos inclosos duren tres minuts, però s'adapten a 1, 2, 5, 15 minuts o a una durada lliure.

## Progressos

1. Es van preparar quatre aparences; l'editorial clara és la inicial.
2. Es van integrar set vídeos optimitzats, set portades i una seqüència de 24 fotografies.
3. Es van afegir dues vistes: Taula per controlar la sessió i Projecció perquè la imatge sigui protagonista. La pantalla completa amaga els controls.
4. Es va retirar el marc de Polaroid del rellotge principal perquè el fons es vegi clarament. L'esfera i les agulles queden superposades amb opacitat regulable.
5. Es van afegir durades ràpides, marques amb nom sense límit fix, rànquing opcional i exportació CSV.
6. Es va crear el repositori públic `Beilo-byte/TEMPUS` i es va activar GitHub Pages.

## Incidències resoltes

- En una prova curta, l'edició numèrica podia deixar la durada interna antiga fins a perdre el focus. Ara els camps actualitzen el compte durant l'entrada i el botó Comença torna a comprovar la durada.
- En una pantalla horitzontal baixa, el rellotge quedava retallat. La mida ara depèn de l'alçada disponible; a 1809 × 702 píxels es veu sencer i el panell cap sense desplaçament.
- El rellotge petit de Projecció perdia contrast sobre vídeos foscos. Ara té una base circular molt transparent que manté visible la imatge.
- Es va obrir per error un registre de Sites, però es va aturar sense publicar. La versió lliurada i activa és exclusivament GitHub Pages i el ZIP local.

## Comprovacions finals

- Un compte curt arriba a `00:00:00`, situa les agulles a les 12 i mostra l'última fotografia.
- La pausa congela tant el temps com el vídeo; la represa continua amb el temps restant.
- En un compte d'un minut, el temps transcorregut i la posició del vídeo mantenen la mateixa proporció.
- Dues marques amb nom registren temps diferents i el CSV s'ha obert i comprovat.
- S'han revisat les vistes horitzontal i mòbil vertical, les quatre aparences i la pàgina publicada amb el vídeo i les agulles carregats.
- El ZIP s'ha descomprimit de prova i totes les rutes del manifest existeixen.

## Ús i límits

Els vídeos de l'aplicació es reprodueixen sense música per deixar clar l'avís final. Les fotos o vídeos propis i les marques d'alumnes viuen a la pestanya actual; exporta les marques abans de tancar-la. L'aplicació no envia els noms a cap servidor.
