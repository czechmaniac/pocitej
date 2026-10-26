# Šachy v Počítáme

Herna používá stávající účty Počítáme. Online partie, hodiny a šachový žebříček mají vlastní data; nemění body počítání. Proti počítači lze hrát i bez přihlášení.

## Aktualizace: podzimní vzhled, hodiny a šachový žebříček

1. Ve **stávající databázi Počítáme** importuj `api/chess-clocks-schema.sql`. Přidá dvě pomocné tabulky `pc_chess_invite_options` a `pc_chess_clocks`. Stávající hráči, partie, pozvánky i počítání zůstávají zachované. SQL lze spustit opakovaně. Rozpracované staré partie zůstávají bez časového limitu.
2. Nahraj všechny soubory aktualizačního ZIPu při zachování adresářů `api` a `assets/chess`. Aktualizují se zejména `chess.js`, `chess.css`, `assets/chess/computer-game.js`, `api/chess-api.php` a nové `api/chess-clock.php`/`api/chess-ranking.php`. Součástí jsou i nové obrázky `autumn-background.png` a `autumn-pieces.png`.
3. `index.html` nahraj jako poslední; odkazuje na nové verze skriptů a stylů. Obnov stránku.
4. Otevři Šachy. V části Nová partie vyber 5, 10 či 15 minut na každého hráče, nebo Bez limitu. Volba platí pro novou pozvánku i novou partii s PC.

Konfiguraci připojení a hesla nepřepisuj; balíček je neobsahuje. Pokud aktualizace tabulek zatím neproběhla, staré partie bez limitu fungují dál a časované pozvánky zobrazí informaci, že zatím nejsou připravené.

## Hodiny

Čas se počítá každému hráči zvlášť, bez přídavku za tah. Bílému se spustí při přijetí pozvánky, u PC při založení nové partie. Po platném tahu se zastaví jeho čas a začne soupeřův. Oranžově zvýrazněné hodiny označují běžící stranu, při posledních 30 sekundách zčervenají.

Online hodiny řídí čas serveru, nikoli hodnoty odeslané klientem. Zbývající čas a okamžik posledního přepnutí jsou uložené na serveru. Obnovení stránky, skrytí karty ani výpadek je neresetuje. Pozdní tah se neprovede: server nejprve vyhodnotí vypršení času. Pokud soupeř nemůže dát mat (zejména má pouze krále), je výsledkem časová remíza. Jinak vyhrává soupeř. Výsledek a hodiny se po skončení zmrazí.

Proti PC se hodiny i partie ukládají v tomto prohlížeči podle času zařízení. Běží také při přepnutí karty či zavření stránky a vyhodnotí se při návratu. Je-li již spuštěný výpočet tahu u časované partie, při skrytí karty se zbytečně neruší. Hry proti PC nevstupují do online žebříčku. Staré uložené PC partie bez hodin zůstávají bez limitu.

## Šachový žebříček

Tlačítko Šachový žebříček vedle Celá obrazovka ukáže samostatné celkové pořadí za dokončené online partie. Výhra je 1 bod, remíza půl bodu a prohra 0 bodů. U každého hráče jsou body, výhry, remízy a prohry. Pořadí určuje počet bodů a pak počet výher; shodné hodnoty mají shodné pořadí. Zobrazuje se prvních 100 hráčů a vlastní pořadí i mimo první stovku.

Body se počítají z výsledků uložených partií. Opakované načtení, opakování požadavku či obnova stránky nemůže přičíst body podruhé. Zahrnují se i dříve dokončené online partie. Žebříček při načtení vyhodnotí také časované partie, kterým mezitím vypršel čas.

## Online herna a PC

- Seznam hráčů s otevřenou hernou; přítomnost platí 60 sekund od posledního kontaktu. Vyhledávání podle přezdívky. Pětiminutové pozvánky s uvedeným časem, přijetí/odmítnutí/zrušení a náhodné barvy.
- Jedna rozehraná online partie na hráče. Uložená pozice se po přihlášení obnoví. Režim Bez limitu umožňuje pokračovat kdykoliv; časovaná partie běží i při nepřítomnosti.
- Otočení desky, zvýraznění legálních a posledních tahů, rošáda, braní mimochodem a čtyři proměny. Šach/mat/pat, běžné případy nedostatečného materiálu, dohoda o remíze a vzdání s potvrzením.
- Na svém tahu lze pro současnou pozici nárokovat remízu při třech opakováních nebo 50 tazích obou stran bez pěšce či braní. Pět opakování / 75 takových tahů ukončí partii automaticky, s předností matu. Předběžný nárok s dosud neprovedeným tahem rozhraní nepodporuje.
- PC má lehkou, střední a těžší úroveň a volbu barvy. Výpočet běží s omezeným časem ve Workeru, takže neblokuje stránku. Pokračovat s PC obnoví místní partii; Nová partie s PC ji nahradí. Online herna vrátí případnou rozehranou online partii.
- Připojení online se obnovuje přibližně každých 2,5 sekundy ve viditelné herně. Tahy i výsledky řídí server, bez potřeby WebSocket serveru.
- Podzimní pozadí, dvanáct plastičtějších figurek a jejich galerie vycházejí ze zvoleného grafického návrhu. Deska se přizpůsobí oknu; Celá obrazovka nabídne větší plochu. Mobil používá šířku displeje a skládá panely pod sebe.

## První instalace šachů

Pokud herna ještě vůbec není nainstalovaná, místo aktualizačního SQL použij celé `api/chess-schema.sql`: vytvoří tři základní a dvě pomocné tabulky. Pak nahraj celý instalační balíček včetně `api/vendor/p-chess/`. Vyžaduje PHP 8.1+, PDO MySQL a ctype, MySQL/MariaDB a HTTPS. Na produkci není potřeba Node.js ani Composer. Samotný aktualizační balíček předpokládá již fungující šachovou hernu.

## Ověření a zdroje

Testy kontrolují legální pozice (perft 400/2039), speciální tahy, tři úrovně PC a obnovení. Přibyly deterministické testy hodin pro PHP i PC a skutečné PHP/MySQL testy volby času, přepínání, odmítnutí pozdního či pozměněného požadavku, časové výhry/remízy a jednorázového pořadí. Dvě oddělená přihlášení ověřují online partii a zobrazení žebříčku; mobil a fullscreen se ověřují v prohlížeči.

Server používá [p-chess/chess](https://github.com/p-chess/chess), MIT, commit `77aa3157e30842c420009fbe14059c72805b228d`; PC používá [chess.js 1.4.0](https://github.com/jhlywa/chess.js), BSD-2-Clause. Licence jsou přiložené. Referencí jsou [pravidla FIDE](https://handbook.fide.com/chapter/E012023), v rekreační herně bez rozhodčího a turnajových sankcí. Obrázky jsou vytvořené pro tuto hernu, všechny soubory se načítají místně bez CDN.
