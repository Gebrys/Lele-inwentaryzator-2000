# Inwentaryzator PWA

Prosta aplikacja webowa instalowana z Safari/Chrome na ekranie głównym. Spis jest zapisywany lokalnie.

## Publikacja na GitHub Pages
1. Utwórz repozytorium (lub użyj osobnego repo) i wgraj wszystkie pliki z tego folderu do katalogu głównego.
2. GitHub: Settings → Pages → Build and deployment → Deploy from a branch.
3. Branch `main`, folder `/ (root)` i Save.
4. Poczekaj na publikację. Otwórz podany adres Pages w Safari na iPhonie.
5. Safari → Udostępnij → Dodaj do ekranu początkowego.

Kamera wymaga HTTPS (GitHub Pages zapewnia HTTPS). Skaner korzysta z BarcodeDetector tam, gdzie jest dostępny, a w innych przeglądarkach z biblioteki ZXing ładowanej z CDN. W przypadku braku skanowania kod można wprowadzić ręcznie.

Na iPhone'ach Web API do wibracji nie jest wspierane przez Safari; dźwięk potwierdzenia działa po interakcji z aplikacją.
