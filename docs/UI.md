# UI v2.1 – kierunek wizualny i zasady budowy frontendu

Kontrakt API i lista funkcji: `iot_spring/docs/V2.1-SPEC.md`. Ten plik opisuje **jak** ma wyglądać i jak jest zbudowany
frontend (Angular 22, Angular Material 3, Leaflet, Chart.js).

## 1. Charakter

Aplikacja to **dziennik pomiarów terenowych** – ślad przejazdu z licznikiem Geigera. Wzorcem są przyrządy pomiarowe
(dozymetr, miernik skażeń) i mapa topograficzna, nie „SaaS dashboard”.

- Interfejs jest spokojny i neutralny; **kolor należy do danych** – skala dawki jest jedynym mocnym kolorem na ekranie.
- Jedyny „głośny” element: **odczyt dawki** (komponent `app-dose-readout`) – duża liczba w rozszerzonym kroju
  z paskiem skali i wskazówką, jak w mierniku. Używany na dashboardzie (urządzenia live), w widoku trasy (max / średnia)
  i w legendzie mapy. Wszystko wokół niego jest ciche.
- Liczby zawsze `font-variant-numeric: tabular-nums`, jednostki mniejszym stopniem pisma obok liczby.
- Ruch tylko tam, gdzie coś się zmieniło: puls głowicy śladu przy nowej próbce live, płynne przesunięcie wskazówki
  odczytu. Brak animacji wejścia sekcji. `prefers-reduced-motion` wyłącza puls i przejścia.

## 2. Tokeny

### Kolor interfejsu (Material 3, motyw z własnej palety)

| Rola | Jasny | Ciemny | Uwagi |
|---|---|---|---|
| primary (seed) | `#2F5D8A` | generowany | „błękit mapy” – wody, poziomice; przyciski, aktywna nawigacja |
| tertiary | `#8A5A00` | generowany | bursztyn znaku ostrzegawczego – tylko alerty / ostrzeżenia |
| neutral | `#5F6368`-owa skala z odcieniem niebieskim | generowany | tła i powierzchnie (surface containers) |
| error | M3 domyślny | M3 domyślny | |

Motyw: `mat.theme((color: (primary: $primary-palette, tertiary: $tertiary-palette, theme-type: color-scheme), typography: ..., density: 0))`
z paletami wygenerowanymi przez `ng generate @angular/material:theme-color` (seed `#2F5D8A`, tertiary `#8A5A00`).
Jasny / ciemny przez `color-scheme` na `<html>` (`light`, `dark`, `light dark` dla „system”).
Karty: `appearance="outlined"`, cienie tylko dla elementów pływających (menu, dialog, snackbar).

### Skala dawki (dane)

Ciągły gradient o tych samych progach co w pracy magisterskiej (µSv/h): ≤ 0,02 `#005500` → 0,10 `#00DD00` →
0,14 `#EEEE00` → 0,20 `#FF8800` → 0,26 `#CC0000` → ≥ 0,30 `#800000`. Kolor liczony interpolacją (`DoseScale.color(usv)`),
jedno źródło dla mapy, wykresów, legendy i odczytu. Próbki bez GPS: szary `--app-no-fix` (`#9AA0A6`).

### Typografia

- Krój: **Archivo** (Google Fonts, zmienny: waga 400–700, szerokość 62–125). Jeden krój w całej aplikacji;
  osobowość daje oś szerokości.
- Tekst i UI: Archivo, szerokość 100, waga 400 / 500.
- Nagłówki stron: waga 600, szerokość 112.
- Odczyt dawki i kafelki liczb: waga 600, szerokość 125 (rozszerzony), `tabular-nums`.
- Skala: 12 / 14 (tekst) / 16 / 20 / 28 / 40 / 56 (odczyt). Długość linii opisów ≤ 72 znaki.
- Bez WERSALIKÓW na etykietach, bez „eyebrow” nad nagłówkami, bez kropek `·` jako separatorów metadanych
  (używamy osobnych elementów z odstępem lub ikoną).

### Odstępy i kształt

Siatka 4 px; odstępy 8 / 12 / 16 / 24 / 32. Promienie wg M3 (karty 12 px, pola 4 px, chipy 8 px).
Treść wyrównana do lewej, max szerokość 1440 px (widok trasy i mapa – pełna szerokość).

## 3. Układ

```
Desktop (≥ 1024 px)                                Telefon (< 600 px)
┌────┬───────────────────────────────────────┐     ┌───────────────────────┐
│rail│ top bar: tytuł   [Szukaj… Ctrl+K]  ● 🔔 👤│     │ top bar: tytuł  🔍 🔔 │
│    ├───────────────────────────────────────┤     ├───────────────────────┤
│ ⌂  │                                       │     │                       │
│ ⇢  │            treść strony               │     │      treść strony     │
│ ▦  │                                       │     │                       │
│ ⌁  │                                       │     ├───────────────────────┤
│ ⚠  │                                       │     │ ⌂   ⇢   ▦   ⌁   ⋯     │  bottom nav
└────┴───────────────────────────────────────┘     └───────────────────────┘
```

- Nawigacja: Dashboard, Trasy, Mapa, Urządzenia, Alerty (z licznikiem), Zdarzenia, Ustawienia.
  Tablet: rail; telefon: dolny pasek (4 pozycje + „Więcej”).
- ● w top barze = stan połączenia live (zielony punkt / szary „offline”), tooltip z opisem.

### Widok trasy `/routes/:id`

```
┌──────────────────────────────┬──────────────────────┐
│                              │ nazwa trasy   [⋯]    │
│                              │ urządzenie, data     │
│            MAPA              │ ┌──────────────────┐ │
│   (warstwy, heat, legenda,   │ │ max 0,184 µSv/h  │ │  <- app-dose-readout
│    pełny ekran, odtwarzanie) │ │ ▁▂▃▅▇██▇▅ │▲     │ │
│                              │ └──────────────────┘ │
│                              │ dystans  czas  dawka │
│                              │ średnia  min   GPS % │
├──────────────────────────────┴──────────────────────┤
│ wykres µSv/h + CPM (kursor zsynchronizowany z mapą)  │
├───────────────────────────┬─────────────────────────┤
│ najgorętsze punkty        │ histogram poziomów      │
└───────────────────────────┴─────────────────────────┘
```

Telefon: mapa 55 vh, pod nią odczyt i kafelki, potem zakładki „Wykres / Punkty / Znaczniki”.

## 4. Architektura kodu

```
src/app/
  core/            api/ (typy + serwisy HTTP per obszar), auth/, live/ (SSE), prefs/, i18n/, units/, theme/
  shared/          dose-readout, dose-scale, sparkline, track-thumbnail, stat-tile, empty-state, page-header,
                   confirm-dialog, map/ (leaflet helpers: warstwy, heat layer, track renderer), chart/ (chart.js helpers)
  layout/          shell (rail / bottom nav / top bar), command-palette, notifications-menu
  features/        dashboard, routes (list, detail, compare), map, devices (list, detail, import dialog),
                   alerts (list, rules), events, settings (preferences, password, users), auth (login), share
```

- Komponenty standalone, `ChangeDetectionStrategy.OnPush`, sygnały (`signal`, `computed`, `input()`, `output()`,
  `httpResource` / `resource` tam, gdzie pasuje), nowa składnia `@if/@for/@defer`, aplikacja zoneless.
- Trasy lazy (`loadComponent`), guard `authGuard` (redirect na `/login?returnUrl=`), `adminGuard`.
- Teksty przez `TranslatePipe` (`'routes.title' | t`) i słowniki `core/i18n/pl.ts`, `en.ts` (typowane – klucze z `pl`).
- Jednostki: `DosePipe` (`value | dose` → np. `0,184 µSv/h` / `184 nSv/h` / `18,4 µR/h` wg preferencji),
  `DistancePipe`, `DurationPipe`. Liczby formatowane `Intl` wg języka.
- Błędy HTTP: interceptor → snackbar z `detail` z problem+json; 401 → przekierowanie na login.
- Leaflet: CSS i ikony z `node_modules` (angular.json `styles` / `assets`), renderer canvas.
- Chart.js: oś X liniowa w ms + własne formatowanie (bez adaptera dat), rejestracja tylko używanych elementów.
- PWA: `public/manifest.webmanifest` + ręcznie napisany `public/sw.js` (shell cache-first, `/api` network-first
  z fallbackiem do cache tylko dla GET), rejestrowany w produkcji.
