# Sicherheitsprüfung November 2026

Stand: 09.11.2026, Ausgangsstand `0e1d408`, Slice `cast-themes-audit`.
Geprüft: Python-Dateien, Django-Templates, Vue-/TypeScript-Quellen und das
vollständige npm-Lockfile inklusive Entwicklung; keine produktiven Sites.

| Befund / Stelle | Schwere | Fix / Status |
| --- | --- | --- |
| `components/PostList.vue`: Beschreibung per `v-html` | Hoch, falls unvertrauenswürdiges HTML die API erreicht | Behoben in `cast-vue-sanitizer`: berechnetes `descriptionHtml` verwendet die zentrale DOMPurify-Allowlist. |
| `components/PostItem.vue`: Detail/Übersicht per `v-html`, `stripAudioBlocks` | Hoch, falls unvertrauenswürdiges HTML die API erreicht | Behoben in `cast-vue-sanitizer`: nach Entfernung der alten Audio-Blöcke wird jeder HTML-Ausgabepfad mit derselben Allowlist bereinigt. Galerie-URLs in Datenattributen werden ebenfalls geprüft, bevor Vue sie in das Modal kopiert. |
| `package-lock.json`: Vitest/mocker und Formatierungsabhängigkeiten | Mittel | Behoben: Vitest und Coverage mindestens 4.1.12; Test-Utils 2.4.11 festgesetzt, `js-beautify` per npm-Override auf 1.14.8. Dessen glob-8-/editorconfig-0.15-Baum vermeidet die gemeldeten verwundbaren neueren Linien. Temporärer Kompatibilitäts-Pin: nach Upstream-Reparatur aktualisieren; glob 8/inflight sind deprecated. |

Komponentenpfade liegen unter `cast_vue/static/src/js/cast_vue/`.
Der ursprüngliche Slice behob die Abhängigkeitsprobleme; der Folgeslice
`cast-vue-sanitizer` schließt die drei `v-html`-Senken. Vue kompiliert `v-html` nicht als Template. Kommentare
(`CommentItem.vue`) verwenden escaped Textinterpolation. `PodlovePlayer.vue`
setzt `innerHTML` nur auf den konstanten leeren String. In den eigenen
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

## Richtext-Allowlist (`cast-vue-sanitizer`, 09.11.2026)

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
Ohne Sanitizer-Aufrufe an den drei Senken schlugen in der ursprünglichen Suite 38 Regressionstests fehl, in der erweiterten Suite (117 Tests) 57.
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
