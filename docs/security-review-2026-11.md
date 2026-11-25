# Sicherheitsprüfung November 2026

Stand: 09.11.2026, Ausgangsstand `0e1d408`, Slice `cast-themes-audit`.
Geprüft: Python-Dateien, Django-Templates, Vue-/TypeScript-Quellen und das
vollständige npm-Lockfile inklusive Entwicklung; keine produktiven Sites.

| Befund / Stelle | Schwere | Fix / Status |
| --- | --- | --- |
| `components/PostList.vue`: Beschreibung per `v-html` | Hoch, falls unvertrauenswürdiges HTML die API erreicht | In `cast-vue-sanitizer` mit einer DOMPurify-Allowlist bereinigt; am 25.11.2026 wieder entfernt (siehe unten): vertrauenswürdiger, redaktioneller Inhalt der eigenen API. |
| `components/PostItem.vue`: Detail/Übersicht per `v-html`, `stripAudioBlocks` | Hoch, falls unvertrauenswürdiges HTML die API erreicht | In `cast-vue-sanitizer` mit derselben Allowlist bereinigt (inklusive Galerie-URLs in Datenattributen); am 25.11.2026 wieder entfernt (siehe unten). |
| `package-lock.json`: Vitest/mocker und Formatierungsabhängigkeiten | Mittel | Behoben: Vitest und Coverage mindestens 4.1.12; Test-Utils 2.4.11 festgesetzt, `js-beautify` per npm-Override auf 1.14.8. Dessen glob-8-/editorconfig-0.15-Baum vermeidet die gemeldeten verwundbaren neueren Linien. Temporärer Kompatibilitäts-Pin: nach Upstream-Reparatur aktualisieren; glob 8/inflight sind deprecated. |

Komponentenpfade liegen unter `cast_vue/static/src/js/cast_vue/`.
Der ursprüngliche Slice behob die Abhängigkeitsprobleme; der Folgeslice
`cast-vue-sanitizer` bereinigte die drei `v-html`-Senken, was am 25.11.2026
wieder entfernt wurde (siehe letzter Abschnitt). Vue kompiliert `v-html` nicht als Template. Kommentare
(`CommentItem.vue`) verwenden escaped Textinterpolation. `PodlovePlayer.vue`
verwendet eigene Container und entfernt alte Player-Frames bei Quellenwechsel
oder Unmount. In den eigenen
Django-Templates kein `safe`, `mark_safe` oder `autoescape off`; Konfiguration
steht in quoted, escaped Datenattributen bzw. `json_script`. Includes/extends
verwenden feste Pfade, keine Request-gesteuerten Dateileser gefunden.

Das ursprüngliche Lockfile meldete sieben moderate Paketbefunde (vier eigenständige
Advisories, übrige transitiv):
- [Vitest mock registration](https://github.com/advisories/GHSA-qxg6-89mg-rqv8)
- [Vitest Windows traversal](https://github.com/advisories/GHSA-xp26-3454-mjgp)
- [glob cancellation](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4)
- [minimatch amplification](https://github.com/advisories/GHSA-g3hv-75wg-m249)

Regression: derselbe vollständige Lockfile-Audit schlägt vor dem Fix fehl und
meldet danach 0 Advisories. `npm run audit` macht die Prüfung wiederholbar;
Registry-/Scannerfehler bleiben Fehler. Mit Node 24 (wie in CI) laufen
`npm ci`, `npm run audit` (0 Advisories), Vitest (32 Tests) und der
Produktionsbuild erfolgreich; das Theme hat keine Browser-Tests. Das Audit betrifft auch Entwicklungsserver, nicht
nur ausgelieferten Browsercode. Der global von django-cast gelieferte Podlove
Player und eigene Core-/Site-Templates sind durch diesen npm-Audit nicht erfasst.

## Richtext-Allowlist (`cast-vue-sanitizer`, 09.11.2026; entfernt 25.11.2026)

Historischer Stand; Allowlist, DOMPurify, Fixture und Tests wurden am
25.11.2026 entfernt (siehe letzter Abschnitt).

DOMPurify ist exakt auf `3.4.17` festgesetzt (inklusive Lockfile). Die zentrale
Policy in `helpers/sanitizeRichText.ts` erlaubt Absätze, Links, Listen,
Überschriften, Code/pre, Figuren/Bildunterschriften, responsive Bilder und
native Audio-/Video-Quellen. Galerie-IDs, Klassen und die vom Vue-Modal
verwendeten Datenattribute bleiben erhalten. Beliebige Datenattribute, Skripte,
Eventhandler, Inline-Styles, SVG/MathML, Frames und Objekte sind nicht erlaubt.
HTTP(S) und relative URLs bleiben erhalten, bei Links zusätzlich mailto/tel.
Ein DOMPurify-Hook prüft Medien-URLs und jeden srcset-Kandidaten, auch in den
Galerie-Datenattributen. `javascript:` und sämtliche `data:`-URLs werden entfernt;
die geprüften Cast-Bild-/Galerie-Templates benötigen keine eingebetteten Datenbilder.
Tabellen, semantische Inline-Elemente (`mark`, `q`, `cite`, `abbr` u. a.) und
ARIA-Attribute bleiben ebenfalls erhalten. Wagtail-Embed-iframes bleiben nur mit
HTTPS-`src` auf den Video-Hosts `www.youtube.com`, `youtube.com`,
`www.youtube-nocookie.com` und `player.vimeo.com` (Standardport) erhalten;
`allow`, `allowfullscreen`, `frameborder` und `referrerpolicy` gelten nur für
diese iframes. Andere iframes werden samt Element entfernt, `srcdoc` und
`sandbox` immer.
Neue aktive Embeds benötigen eine gesondert geprüfte Integration, keine pauschale
Erweiterung dieser Policy. Servervalidierung, der globale Podlove-Player und
eigene serverseitige Templates bleiben eigenständige Vertrauensgrenzen.

Die Vitest-Fixture `fixtures/castRichText.html` bildet gerendertes Cast-Markup
ab (Quellen siehe Fixture-README). Sie bleibt nach Bereinigung unverändert;
Komponententests prüfen alle drei Senken, Prop-Updates, Galerie-Modal-Quellen
und weiterhin funktionierende Audio-Ersetzung/Artikelmetadaten. Payloads decken
Skripte, onerror, javascript-Links (auch mit Zeichenreferenzen), SVG-onload,
Daten-URLs, gemischte srcsets und gefährliche Galerie-Datenattribute ab.
Ohne Sanitizer-Aufrufe an den drei Senken schlugen in der ursprünglichen Suite 38 Regressionstests fehl, in der erweiterten Suite (117 Tests) 57: 52 Senken-Payloads, 3 Prop-Update- und 2 Galerie-Tests. Die zwei reinen `<script>`-Payloads für Übersicht/Detail bestehen auch ohne Sanitizer, weil `stripAudioBlocks` per DOMParser ein führendes Skript in `<head>` verschiebt.
Mit Node 24: `npm ci`, `npm run audit` (0 Advisories), Vitest (93 Tests; nach der Erweiterung im Merge-Review 117 Tests, lokal Node 26) und
Produktionsbuild erfolgreich. Für die Manifest-Normalisierung wurde lokal
`python3` verwendet, da das Just-Rezept den hier fehlenden Alias `python` aufruft.

### Abgleich mit Live-Inhalten (Merge-Review, 09.11.2026)

Alle öffentlichen Posts von python-podcast.de (68) und wersdoerfer.de (728) wurden
über die Wagtail-API mit `template_base_dir=vue` geladen; Detail-, Übersichts- und
Blogbeschreibungs-HTML liefen durch `stripAudioBlocks` und `sanitizeRichText`.
Die erste Fassung der Policy verlor eine Datentabelle, `mark`/`q`/`cite`,
ARIA-Labels der Weeknote-Abschnitte und ein YouTube-Embed; diese Fälle sind nun
erlaubt und durch Tests abgedeckt. Danach bleibt der Text aller Dokumente bis auf
einen Post unverändert. Dort entfallen ein altes Notebook-iframe von einem
nicht freigegebenen Host und sein Inline-Skript (dessen `onload`-Handler im
Vue-Theme ohnehin nicht funktionierte). Darüber hinaus entfallen nur
Editor-Attribute (`data-block-key`), die nur emittierte Weeknote-Angabe
`data-kind`, Inline-Styles an Links/Tabellenzellen und zwei fehlerhaft
formatierte Legacy-`href`s mit Leerzeichen bzw. Zeilenumbruch in der URL (Linktext bleibt).

## Request- und Kommentargrenzen (16.11.2026)

API-GETs haben Größen-/Cachegrenzen und eine Gesamtdauer; ausscheidende Views
brechen ihre eigenen Requests ab. Kommentar-POSTs prüfen vor dem Versand eine
gleichursprüngliche HTTP(S)-Adresse ohne URL-Zugangsdaten und folgen keinen
Redirects. Kommentar-, Sicherheits- und Moderationsdaten werden nicht mehr in
die Konsole geschrieben. Späte Abschlüsse gehören ausschließlich zum ursprünglichen
Post. Kommentarlisten validieren IDs, Eltern und begrenzte Tiefe vor der Rekursion;
Podlove-Versuche besitzen eigene, ablösbare Container und einen Fehler-/Retry-Zustand.
Die genauen Grenzen und Komponentenverträge stehen in der README. Regressionen
verwenden ausschließlich synthetische Daten und kontrollierte Antworten; der globale
Podlove-Code und produktive Sites wurden dabei nicht geprüft.

## Client-Sanitizer entfernt (25.11.2026)

Entscheidung des Betreibers: zusätzliche Schutzschichten, die neue Abhängigkeiten
mitbringen, sind riskanter als nützlich (Supply-Chain-Risiko). Das HTML der drei
`v-html`-Senken stammt aus der django-cast-API derselben Site: redaktionell
erstellte Wagtail-Inhalte, die Wagtail beim Speichern filtert und die das
serverseitig gerenderte Theme (cast-bootstrap5) ebenfalls unbereinigt ausgibt.
Der Client-Sanitizer war daher nur eine zusätzliche Schicht ohne konkret
ausnutzbaren Fehler. `dompurify`, `helpers/sanitizeRichText.ts`, die
Richtext-Tests und ihre Fixture sind entfernt; die Senken rendern wieder wie vor
`cast-vue-sanitizer` (`PostList.vue` wieder `<p v-html="blog.description">`).
Unverändert bleiben das Entfernen der alten Audio-Blöcke (`PostItemPodlove`-Tests)
und das Zurücksetzen des Galerie-Modals vor jedem Klick. Vertrauensgrenze ist
damit die redaktionelle Schreibberechtigung in Wagtail.
