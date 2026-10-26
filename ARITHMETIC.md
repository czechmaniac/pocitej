# Operace a rozsahy

Sčítání, odčítání, násobení a dělení mají společný rozsah 10, 20, 50, 100, 1000 nebo ∞. U konečného rozsahu se do limitu vejdou oba operandy i správný výsledek. Odčítání je nezáporné, dělení celočíselné beze zbytku a bez nuly v děliteli. Nesprávné možnosti mohou přesáhnout zvolený rozsah.

∞ nemá uživatelem vybraný rozsah: pro jednotlivé příklady náhodně míchá rozsahy od 10 do 1 000 000. Praktický technický strop zachovává čitelnost na mobilu a přesný výpočet v JavaScriptu i PHP.

Rozklad na první odečtení do 10 zůstává jen u odčítání s prvním číslem 11–20 a výsledkem pod 10. Vyšší čísla používají výběr výsledku. Pokyn se zobrazí jen u sady s rozkladem. Souboje používají výběr odpovědi pro všechny operace.

Host i přihlášený profil kontrolují výběr čísla okamžitě. Statistiky zaznamenají pouze první pokus. Pole multiplicationLimit se zachovává kvůli kompatibilitě uložených profilů; generování všech operací nyní řídí range (0 znamená ∞).

U rozsahů nad 20 se generuje nejvýše 240 unikátních kandidátů s omezeným počtem pokusů, nikoli všechny dvojice do limitu. Sada má stále 6, 9 nebo 12 různých příkladů.

## Nasazení přes FTP

Přepsat soubory index.html, script.js, cloud.js, exercises.js, battle.js, analytics.js, style.css, battle.css a api/logic.php. Zachovat adresář api. index.html obsahuje nové verze odkazů pro vyprázdnění mezipaměti skriptů a stylů. Při nasazení nejprve nahrát ostatní soubory a index.html jako poslední. Poté načíst Nové příklady.

Databázové schéma ani konfigurační soubory se nemění.

Možnosti odpovědí: správný výsledek náhodně střídá číselnou velikost vůči ostatním (nejmenší/prostřední/největší podle nezáporného oboru). Pořadí tlačítek je nezávisle promíchané. Platí pro všechny operace, místní i serverové generování a souboje.
