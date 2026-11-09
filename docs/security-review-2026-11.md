# Sicherheitsprüfung November 2026

Stand: 09.11.2026, Ausgangsstand `0e1d408`, Slice `cast-themes-audit`.
Geprüft: Python-Dateien, Django-Templates, Vue-/TypeScript-Quellen und das
vollständige npm-Lockfile inklusive Entwicklung; keine produktiven Sites.

| Befund / Stelle | Schwere | Fix / Status |
| --- | --- | --- |
| `components/PostList.vue:4`: `v-html="blog.description"` | Hoch, falls unvertrauenswürdiges HTML die API erreicht | Offen, größerer Folgepunkt: Beschreibung wird ohne clientseitige Bereinigung eingesetzt. Ereignisattribute und ausführbare Links bleiben HTML. Redaktionelle Schreibrechte und API-Vertrauen prüfen; zentrale Sanitizer-Policy für Richtext mit erlaubten Tags/Attributen festlegen. Kein anonymer Schreibpfad im Theme nachgewiesen. |
| `components/PostItem.vue:24-25,202-208`: `v-html`, `stripAudioBlocks` | Hoch, falls unvertrauenswürdiges HTML die API erreicht | Offen, größerer Folgepunkt: DOMParser und Entfernen von Audio-Blöcken sind keine Bereinigung. Andere Ereignisattribute/gefährliche URLs bleiben erhalten. Sanitizer-Policy gemeinsam mit Core und Medien-/Embed-Vertrag entwickeln; keine pauschale Entfernung, die Galerien oder Embeds beschädigt. |
| `package-lock.json`: Vitest/mocker und Formatierungsabhängigkeiten | Mittel | Behoben: Vitest und Coverage mindestens 4.1.12; Test-Utils 2.4.11 festgesetzt, `js-beautify` per npm-Override auf 1.14.8. Dessen glob-8-/editorconfig-0.15-Baum vermeidet die gemeldeten verwundbaren neueren Linien. Temporärer Kompatibilitäts-Pin: nach Upstream-Reparatur aktualisieren; glob 8/inflight sind deprecated. |

Komponentenpfade liegen unter `cast_vue/static/src/js/cast_vue/`.
Die HTML-Risiken sind bewusst nur dokumentiert; dieser Slice behebt die kleinen
Abhängigkeitsprobleme. Vue kompiliert `v-html` nicht als Template. Kommentare
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
Registry-/Scannerfehler bleiben Fehler. Vitest und Produktionsbuild laufen lokal
mit Node 24, entsprechend CI. Das Audit betrifft auch Entwicklungsserver, nicht
nur ausgelieferten Browsercode. Der global von django-cast gelieferte Podlove
Player und eigene Core-/Site-Templates sind durch diesen npm-Audit nicht erfasst.

Review-Gate: Opus 5.5 / high angefordert; Harness vor Reviewer-Start mit
`TypeError: sequence item 0: expected str instance, int found` abgestürzt
(`CRASHED`, kein Urteil). Deshalb nur Feature-Branch geparkt, kein Merge.
