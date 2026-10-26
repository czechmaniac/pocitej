# Šachy v Počítáme

Nová záložka Šachy používá stejné profily, PINy a přihlášení jako počítání. Host vidí šachovnici, figurky a pravidla; pro online partii se přihlásí stávajícím účtem.

## Co funguje

- Seznam dalších hráčů v herně a hledání podle přezdívky. Online znamená otevřenou hernu a kontakt se serverem během posledních 60 sekund.
- Přímé pozvání registrovaného hráče, přijetí, odmítnutí, zrušení a platnost pozvánky 5 minut. Pozvat lze i hráče, který není právě v herně; pozvánku uvidí, pokud během její platnosti přijde.
- Jedna aktivní partie na hráče, náhodné rozdělení barev, otočení šachovnice, kliknutí/tapnutí na figurku a cílové pole, zvýraznění povolených tahů a posledního tahu.
- Server ověřuje střídání stran, legálnost tahů a ochranu krále. Rošáda, braní mimochodem, proměna na všechny čtyři figurky, šach, mat, pat a běžné případy nedostatečného materiálu.
- Zápis tahů SAN, vzdání partie s potvrzením, nabídka a přijetí/odmítnutí remízy. Pro současnou pozici lze na svém tahu nárokovat třetí opakování nebo pravidlo 50 tahů. Páté opakování a pravidlo 75 tahů jsou automatické; mat má přednost. Předběžné nároky remízy s dosud neprovedeným tahem nejsou součástí rozhraní.
- Partie je bez hodin. Zavření stránky ani výpadek nepřisoudí prohru, po přihlášení se obnoví ze serveru.
- Aktualizace přibližně každé 2,5 sekundy ve viditelné herně. Nevyžaduje WebSocket server. Šachové partie nemění body a statistiky počítání.

## Hra proti počítači a větší plocha

Hra proti PC funguje i hostům. Vyber lehkou, střední nebo těžší obtížnost a bílé/černé figurky. Jedná se o jednoduchého místního soupeře s omezeným hledáním, nikoli o turnajový engine. Výpočet probíhá ve Web Workeru, takže neblokuje ovládání stránky. Rozpracovaná partie s PC se ukládá do tohoto prohlížeče zvlášť pro hosta a každý přihlášený profil. Tlačítko Pokračovat s PC ji obnoví; Nová partie s PC ji nahradí novou. Tlačítko Online herna vrátí seznam hráčů a případnou uloženou online partii.

Šachovnice používá dostupnou výšku a šířku okna, boční panely se podle místa rozdělí do sloupců. Celá obrazovka otevře větší herní plochu; v prohlížeči bez nativního fullscreenu použije plochu okna. Na mobilu zůstává šachovnice přes šířku displeje a panely pod ní.

Aktualizace z předchozí šachové verze **nevyžaduje změnu databáze**. Nahraj obsah aktualizačního ZIPu včetně `assets/chess/`, `chess-worker.js` a `api/logic.php`; `index.html` jako poslední. Potom klikni v počítání na Nové příklady, aby se vygenerovaly nové možnosti odpovědí.

## Nasazení na stávající hosting

1. Ve správě **stávající databáze Počítáme** spusť soubor `api/chess-schema.sql`. Přidá tři tabulky `pc_chess_presence`, `pc_chess_invites` a `pc_chess_games`; stávající tabulky ani jejich obsah neupravuje. SQL lze spustit opakovaně.
2. Nahraj všechny soubory FTP balíčku při zachování složek. Ve složce `api/vendor/p-chess/` musí být všechny přiložené PHP soubory i licence.
3. `index.html` přepiš jako poslední. Odkazy obsahují nové verze skriptů, aby se načetla aktualizace.
4. Obnov stránku, přihlas se a otevři Šachy. Druhý hráč se přihlásí svým účtem na druhém zařízení nebo v jiném profilu prohlížeče. Oba otevřou hernu, jeden zadá přezdívku a pošle pozvánku, druhý ji přijme.

Balíček obsahuje aktuální soubory `index.html`, `script.js`, `cloud.js`, `chess.js`, `chess.css`, `analytics.js`, `api/index.php`, `api/chess-api.php`, `api/chess-core.php`, `api/chess-schema.sql` a složku `api/vendor/p-chess/`. Je určený jako rozšíření již nasazeného Počítáme s dělením a aktuálními rozsahy. Konfigurační soubory s připojením k databázi a hesly se nemění a nejsou součástí balíčku.

Vyžaduje PHP 8.1+ s rozšířeními PDO MySQL a ctype, MySQL/MariaDB a HTTPS (stávající konfigurace webu). Na hostingu není nutný Node.js ani Composer. Při prvním nasazení je třeba mít právo vytvořit tři nové tabulky; za běhu herna používá běžná oprávnění pro čtení a zápis.

## Technické ověření

`php tests/chess-rules.php` kontroluje standardní počty legálních pozic (perft), oba typy rošády a zákaz průchodu šachem, braní mimochodem včetně odrytého šachu, proměny, vazbu, mat, pat, materiál a opakování. `node tests/api.cjs` běží proti samostatné testovací databázi; šachové testy zahrnují dva reálné prohlížeče se samostatnými přihlášeními.

Tah obsahuje revizi partie a ID požadavku. Server kontroluje účastníky, CSRF/origin a pravidla, změny ukládá v transakci se zámky. Opakování posledního již přijatého tahu je bezpečné; zastaralé tahy se odmítnou a klient načte aktuální stav. Vyhledávání neposílá e-maily, PINy ani osobní údaje, jen přezdívky a dostupnost.

Volby výsledků se nově liší i číselnou velikostí: správná odpověď může být nejmenší, prostřední i největší (pokud to dovoluje nezáporný obor). Obě chybné možnosti mohou ležet na stejné straně správného výsledku. Tlačítka se nadále náhodně promíchávají. Pravidla jsou společná pro hosta, přihlášený profil i souboje.

## Zdroje

Šachová knihovna [p-chess/chess](https://github.com/p-chess/chess), licence MIT, připnutý commit `77aa3157e30842c420009fbe14059c72805b228d`. Jádro je přiloženo beze změn, včetně licence. [Pravidla FIDE](https://handbook.fide.com/chapter/E012023) jsou referencí pro tahy a ukončení partie. Tato herna používá rekreační režim bez hodin, rozhodčího a turnajových sankcí.

Pro hru proti PC je přiložena [chess.js 1.4.0](https://github.com/jhlywa/chess.js) s licencí BSD-2-Clause v `assets/chess/LICENSE`. Produkce načítá všechny skripty místně; nepoužívá CDN ani externí službu počítačového hráče.
