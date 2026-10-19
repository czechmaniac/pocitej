Run `node tests/rules.cjs` with PHP 8.1+ and Node.js installed. It compares every generated JS/PHP exercise and checks answer validation and first-attempt accounting.

For browser and real API tests, install `playwright@1.62.1` and its Chromium browser (`npx playwright install chromium`). Run `node tests/browser.cjs`. Set `BROWSER_CHANNEL=chrome` to use installed Chrome instead. The browser test covers guest persistence, mixed worksheet inputs, cloud payloads, mobile paging and battle network retries. Its cloud responses are fixtures.

Run `node tests/api.cjs` with an **empty, disposable** MySQL database specified by `TEST_DB_NAME`, `TEST_DB_HOST`, `TEST_DB_PORT`, `TEST_DB_USER`, and `TEST_DB_PASSWORD`. It creates fixture tables, runs the real PHP API from a temporary copy, and checks retries and statistics. It refuses a database containing tables. `PHP_BINARY` can override the PHP executable. The schema in this folder is a test fixture, not a production migration.

Deployment: upload `exercises.js` together with the updated HTML, JS, CSS and PHP files. Existing settings/statistics remain valid; sets started with the previous answer contract receive a request to load new exercises. No database schema migration is needed. Battle exercises contribute to solved/correct/streak and weekly points using the same first-check rule; a single battle question does not count as a completed worksheet set. Coins and combat rewards retain their existing local storage.

Battles always use three answer choices, including subtraction across ten. Decomposition remains required only in worksheets. Upload index.html, exercises.js, battle.js, api/index.php and api/logic.php together for this change.
