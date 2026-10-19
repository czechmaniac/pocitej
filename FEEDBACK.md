# Nápady návštěvníků — nasazení přes FTP

## Co návštěvník uvidí

Okno „Co bys chtěl změnit nebo přidat?“ se otevře nejvýše jednou za sedm dní v daném prohlížeči. Lze ho přeskočit tlačítkem Teď ne nebo klávesou Escape. Tlačítko „Poslat nápad“ pod aplikací umožní poslat návrh kdykoli. Funguje pro hosta i přihlášeného.

Kategorie jsou Mám nápad, Něco nefunguje a Něco jiného. Text má 3–1000 znaků. Zpráva se ukládá jen do databáze webu; do Google Analytics se její text neposílá. Nevyžaduje se jméno ani kontakt a automaticky se nepřidává profil nebo IP adresa. Vlastní text může návštěvník vyplnit dobrovolně.

Sedmidenní omezení je uložené v prohlížeči. Vymazání dat nebo jiný prohlížeč ho obnoví. Pokud je ukládání v prohlížeči zakázané, okno se potlačí pouze do opuštění stránky. Při nedostupném nebo ještě nenastaveném úložišti se automatické okno ani tlačítko nezobrazují.

## Soubory na FTP

Do kořenové složky webu nahraj `index.html`, `feedback.js`, `feedback.css`.

Do složky `api` nahraj `feedback.php`, `feedback-common.php`, `feedback-admin.php`, `feedback-admin.config.example.php`.

Existující `api/config.php` zůstává beze změny. Nové soubory používají jeho stávající připojení k databázi. Soubor s vlastním heslem správce se do GitHubu neukládá.

## Zapnutí soukromého přehledu

1. Na počítači zkopíruj `api/feedback-admin.config.example.php` jako **`feedback-admin.config.php`**.
2. V textovém editoru v tomto novém souboru nahraď `SEM_NAPIS_VLASTNI_DLOUHE_HESLO` vlastním unikátním heslem s alespoň 16 znaky. Zachovej uvozovky a ostatní text. Pro snadné vložení použij alespoň 16 náhodných písmen a číslic bez apostrofu nebo zpětného lomítka. Nepoužívej dětský čtyřmístný PIN.
3. Nahraj tento vlastní soubor do `api` na FTP.
4. Otevři **https://pocitej.janstan.cz/api/feedback-admin.php** a přihlas se novým heslem.
5. Při prvním přihlášení se vytvoří nová tabulka **`pc_feedback`**. Existující data procvičování se nemění. Databázový účet musí mít oprávnění CREATE TABLE.
6. Otevři hlavní web a obnov ho. Okno je nyní zapnuté; vyzkoušej odeslat vlastní návrh a zkontroluj ho v soukromém přehledu.

Přehled ukazuje nové a všechny návrhy, kategorii a datum. Zprávu můžeš označit jako přečtenou; ve „Všechny návrhy“ zůstává dostupná. Přihlášení správce platí 30 minut a lze se odhlásit. Změna hesla v souboru ukončí platnost starých přihlášení. Přehled není součástí veřejného menu a neobsahuje měření Google Analytics.

Pro vypnutí sběru přejmenuj na FTP soubor `feedback-admin.config.php`, aby pod tímto názvem nebyl dostupný. Uložené návrhy se tím nesmažou.

## Testy

`node tests/feedback-browser.cjs` ověřuje mobilní okno, Escape, týdenní prodlevu, ruční otevření, opakování po síťové chybě a vypnutou službu. `node tests/api.cjs` v prázdné testovací databázi ověřuje také ukládání od hosta, soukromý přístup, přihlášení správce, validaci, CSRF, omezení jedné nové zprávy za minutu v relaci, opakování stejného požadavku a bezpečné vykreslení textu.
