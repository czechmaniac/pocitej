# Přehled používání v Google Analytics 4

Nasadit společně `analytics.js`, `index.html`, `script.js`, `battle.js`, `cloud.js`. Aktualizace nemění PHP ani databázi. Události vznikají až po vstupu hosta nebo přihlášeného do aplikace. Blokování analytiky ani její výpadek nesmí zastavit aplikaci. Dosavadní vypnutí ID nebo `ga-disable-G-1DKYKCDZ49` funguje i pro nové události.

## Co se měří

| Událost | Význam |
| --- | --- |
| `pocitej_open` | Jednou za otevření aplikace v kartě, po vstupu do procvičování |
| `view_section` | Kliknutí do Počítání, Výzev, Nastavení, Pokroků, Odměn nebo Žebříčku |
| `settings_change` | Skutečná změna operace, rozsahu, limitu násobení, počtu příkladů nebo většího písma |
| `practice_start` / `practice_complete` | Načtená / dokončená sada procvičování |
| `battle_start` / `battle_complete` | Zahájený / ukončený souboj (výhra i prohra) |
| `battle_pause` / `battle_resume` | Opuštění aktivního souboje přes menu / návrat do něj |
| `battle_tool` | Skutečné použití lektvaru, štítu nebo speciálního útoku |
| `activity_error` | Chyba načtení příkladu nebo odeslání odpovědi v souboji, pouze pevná kategorie |

Načtení nové sady nemusí znamenat, že uživatel odpověděl. Poměr zahájení a dokončení i návraty jsou vodítka zájmu, nikoli přímé hodnocení zábavnosti. `battle_complete` neznamená výhru. Pozastavení není definitivní odchod; zavření karty se zvlášť neodesílá. Počítají se události, ne unikátní děti.

## Jednorázové nastavení v GA4

V **Správce → Zobrazení dat → Vlastní definice → Vytvořit vlastní dimenzi** vytvoř následující dimenze s rozsahem **Událost**. Název si zvol česky, parametr opiš přesně:

| Název | Parametr | Hodnoty |
| --- | --- | --- |
| Režim účtu | `account_mode` | `guest`, `profile` |
| Operace | `operation` | `addition`, `subtraction`, `multiplication` |
| Rozsah | `number_range` | `10`, `20` (pro sčítání/odčítání) |
| Limit násobení | `multiplication_limit` | `20`, `50`, `100` (pro násobení) |
| Počet příkladů | `exercise_count` | `6`, `9`, `12` (pro procvičování) |
| Větší písmo | `large_text` | `on`, `off` |
| Obrazovka | `screen` | `math`, `battle`, `settings`, `stats`, `rewards`, `leaderboard` |
| Změněné nastavení | `setting` | `operation`, `range`, `multiplicationLimit`, `count`, `largeText` |
| Herní pomůcka | `tool` | `potion`, `shield`, `special` |
| Druh chyby | `error_kind` | `battle_load`, `battle_answer` |

Události nejdřív ověř v **Přehledech → V reálném čase**. V běžných přehledech a vlastních dimenzích počítej s přibližně 24–48 hodinami; historické používání před nasazením tato aktualizace nedoplní.

## Užitečné přehledy

V **Prozkoumat → Volný formát** přidej metriku **Počet událostí**, dimenze **Název události** a vybrané vlastní dimenze:

- Oblíbená nastavení: řádky Operace + Rozsah; filtr `practice_start` nebo `battle_start`. Pro násobení použij Limit násobení místo Rozsahu.
- Počítání proti Výzvám: řádky Název události, filtr na `practice_start`, `practice_complete`, `battle_start`, `battle_complete`.
- Používané části webu: filtr `view_section`, řádky Obrazovka.
- Herní pomůcky: filtr `battle_tool`, řádky Herní pomůcka.
- Problémy v soubojích: filtr `activity_error`, řádky Druh chyby a Kategorie zařízení.

Přezdívka, PIN, ID účtu, pohlaví, konkrétní příklady, odpovědi, skóre ani text chyb se do těchto událostí neposílají. Jde o standardní GA4 měření s jeho běžnými identifikátory prohlížeče; není to slib anonymizace. Automatické měření formulářů v nastavení datového streamu GA vypni, pokud nechceš měřit ani obecné interakce s přihlašovacím formulářem.

Dokumentace Googlu: https://developers.google.com/analytics/devguides/collection/ga4/events a https://developers.google.com/analytics/devguides/collection/ga4/event-parameters.
