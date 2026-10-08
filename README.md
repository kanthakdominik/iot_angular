# iot_angular – aplikacja webowa systemu pomiaru promieniowania

Angular (komponenty standalone, nowa składnia `@if` / `@for`), Bootstrap 5 + ng-bootstrap, Leaflet, Chart.js.
API backendu: `iot_spring/docs/PROTOCOL.md` (sekcja 3).

## Funkcje

- lista tras (urządzenie, data, czas trwania, liczba próbek, opis) z wyszukiwaniem po nazwie / opisie / urządzeniu,
- panel urządzeń: online/offline, ostatni kontakt, bateria, bieżąca trasa; admin: **New route**, **Battery**, zmiana nazwy,
- mapa trasy (tylko próbki z fixem GPS, kolor wg µSv/h, renderer canvas), znaczniki (np. „Am-241”),
- wykresy µSv/h i CPM w czasie – wszystkie próbki, te bez fixu GPS jako szare punkty,
- admin: edycja nazwy i opisu trasy, usuwanie tras / punktów, dodawanie i usuwanie znaczników.

## Uruchomienie lokalne

```bash
npm ci
npm start            # http://localhost:4200, /api jest przekazywane do http://localhost:8080 (proxy.conf.json)
```

Backend lokalnie: `iot_spring` z profilem `local` (TimescaleDB w Dockerze – patrz `application-local.properties`).
Frontend używa względnego `/api`, więc ciasteczka sesji i CSRF działają tak samo jak na produkcji.

## Build produkcyjny / Docker

```bash
npx ng build --configuration production     # wynik: dist/iot-angular/browser
docker build -t iot-frontend .              # obraz Caddy z gotową aplikacją (używany w iot_spring/deploy)
```

## Aktualizacja Angulara 19 → 22 (do zrobienia raz, lokalnie)

Kod jest już napisany w składni zgodnej z Angular 19–22. Samą aktualizację zależności robi oficjalne
narzędzie `ng update` (uruchamia też automatyczne migracje kodu). Po każdym kroku: `npx ng build` i commit.

```bash
npx ng update @angular/core@20 @angular/cli@20
npx ng update @angular/core@21 @angular/cli@21
npx ng update @angular/core@22 @angular/cli@22

# biblioteki zależne od wersji Angulara
npm install @ng-bootstrap/ng-bootstrap@21
npm uninstall ng2-charts @types/chart.js @angular/cdk     # nieużywane (Chart.js jest używany bezpośrednio)
npm install chart.js@latest leaflet@latest @types/leaflet@latest

npx ng build --configuration production
```

Wymagania Angulara 22: Node.js `^22.22.3` lub `^24.15`, TypeScript 6.0 (instaluje go `ng update`).
Jeśli `ng update` zaproponuje migrację na nowy builder `@angular/build` – zgódź się.
