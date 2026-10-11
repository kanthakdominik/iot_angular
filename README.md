# iot_angular – Radmon, aplikacja webowa systemu pomiaru promieniowania

Angular 22 (komponenty standalone, sygnały, bez zone.js), Angular Material 3, Leaflet, Chart.js, PWA (`@angular/service-worker`).

- kontrakt API: `iot_spring/docs/V2.1-SPEC.md` (po scaleniu: `PROTOCOL.md`),
- wygląd i zasady: [`docs/UI.md`](docs/UI.md),
- przewodnik po kodzie (serwisy, komponenty współdzielone, i18n, jednostki, mapy, wykresy): [`docs/FOUNDATION.md`](docs/FOUNDATION.md).

## Ekrany

| Adres | Co jest |
|---|---|
| `/dashboard` | urządzenia na żywo (odczyt dawki, bateria, zasięg), liczniki, ostatnia trasa, kalendarz aktywności, alerty i zdarzenia |
| `/routes` | karty z miniaturą śladu i wykresem albo tabela; filtry (tekst, urządzenie, daty), sortowanie, stronicowanie, zaznaczenie do porównania |
| `/routes/:id` | mapa (warstwy, heatmapa, pełny ekran, odtwarzanie) + statystyki + wykres µSv/h i CPM z kursorem zsynchronizowanym z mapą, najgorętsze punkty, histogram, znaczniki, eksport GPX / GeoJSON / CSV, udostępnianie linkiem, tryb live |
| `/routes/compare?ids=` | 2–4 trasy na jednej mapie i wykresie, tabela statystyk |
| `/map` | mapa zbiorcza wszystkich pomiarów (siatka średni / max) |
| `/devices`, `/devices/:id` | urządzenia, komendy, historia baterii i zasięgu GSM, import plików z karty SD |
| `/alerts` | alerty z potwierdzaniem, reguły (próg dawki, bateria, offline; push przez ntfy) |
| `/events` | dziennik zdarzeń |
| `/settings` | motyw, język PL/EN, jednostka dawki, domyślna warstwa mapy, hasło; admin: użytkownicy |
| `/share/:token` | publiczny podgląd udostępnionej trasy (bez logowania) |

Skróty: `Ctrl+K` / `/` – wyszukiwarka i nawigacja.

## Uruchomienie lokalne

```bash
npm ci
npm start      # http://localhost:4200, /api -> http://localhost:8080 (proxy.conf.json)
```

Backend: `iot_spring` z profilem `local`. Bez backendu zobaczysz tylko ekran logowania.

## Build / Docker

```bash
npx ng build                         # produkcja, wynik: dist/iot-angular/browser
docker build -t iot-frontend .       # obraz Caddy z aplikacją (używany w iot_spring/deploy)
```

Uwagi:

- `optimization.fonts: true` wstawia CSS fontów Google do `index.html` w czasie builda – build potrzebuje internetu.
- `inlineCritical: false` jest celowe: CSP (`script-src 'self'`) blokowałby wczytanie arkusza stylów.
- Service worker działa tylko w buildzie produkcyjnym; po wylogowaniu cache danych API jest czyszczony.

## Do zrobienia raz po aktualizacji do v2.1

Zależności po Bootstrapie / Angularze 19 nieużywane przez nową aplikację (usuń, żeby `package-lock.json` się zaktualizował):

```bash
npm uninstall zone.js @angular/localize @angular/animations @angular/platform-browser-dynamic \
  @types/jasmine jasmine-core karma karma-chrome-launcher karma-coverage karma-jasmine karma-jasmine-html-reporter
```
