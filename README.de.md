<p align="center">
  <img src="assets/banner.jpg" alt="MCP Local RAG: Search below the surface." width="600" />
</p>

# MCP Local RAG

[![GitHub
stars](https://img.shields.io/github/stars/shinpr/mcp-local-rag?style=social)](https://github.com/shinpr/mcp-local-rag)
[![npm
version](https://img.shields.io/npm/v/mcp-local-rag.svg)](https://www.npmjs.com/package/mcp-local-rag)
[![License:
MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![MCP
Registry](https://img.shields.io/badge/MCP-Registry-green.svg)](https://registry.modelcontextprotocol.io/)

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh-CN.md">简体中文</a> |
  <strong>Deutsch</strong> |
  <a href="README.es.md">Español</a> |
  <a href="README.pt-BR.md">Português (Brasil)</a> |
  <a href="README.fr.md">Français</a>
</p>

Durchsuche vertrauliche Dokumente über einen MCP-Client oder das Terminal. Embeddings laufen
standardmäßig lokal; ein OpenAI-kompatibler Endpunkt lässt sich ausdrücklich auswählen.

mcp-local-rag indexiert PDF-, DOCX-, Markdown- und Textdateien direkt auf deinem Rechner. Die
Suche verbindet semantische Ähnlichkeit mit Stichwortsuche. Dadurch findet sie sowohl
inhaltlich verwandte Inhalte als auch exakte technische Begriffe wie API-Namen, Klassennamen
und Fehlercodes. Die Treffer enthalten Textstellen aus der Quelle und, sofern verfügbar,
Überschriften, Zeilen- oder Seitenzahlen. So kannst du im Original nachlesen und die Fundstelle
zitieren.

Es werden weder API-Schlüssel noch Docker, Python oder eine externe Datenbank benötigt. Nach
dem ersten Modelldownload funktionieren Textimport und Suche offline.

## Schnellstart

### Voraussetzungen

- Node.js 22 oder neuer
- Internetzugang beim ersten Start, um das npm-Paket und das Embedding-Modell herunterzuladen
- Ein Verzeichnis mit den zu durchsuchenden Dokumenten

Setze `BASE_DIR` auf dieses Verzeichnis. Es bildet zugleich die Sicherheitsgrenze für
Dateizugriffe. Ersetze `/absolute/path/to/your/documents` in den folgenden Beispielen durch den
absoluten Pfad zu deinen Dokumenten.

Nutze eines der folgenden Beispiele oder registriere `npx -y mcp-local-rag` im
Konfigurationsformat deines Clients und setze dort `BASE_DIR`.

Setze auch `DB_PATH` und `CACHE_DIR` auf absolute Pfade. Relative Pfade beziehen sich auf das
Arbeitsverzeichnis des Servers. Wird er aus verschiedenen Projekten gestartet, entstehen
jeweils ein eigener Index und Modellcache.

<details>
<summary>Claude Code</summary>

Führe diesen Befehl aus:

```bash
claude mcp add local-rag --scope user --env BASE_DIR=/absolute/path/to/your/documents -- npx -y mcp-local-rag
```

</details>

<details>
<summary>Codex</summary>

Ergänze `~/.codex/config.toml`:

```toml
[mcp_servers.local-rag]
command = "npx"
args = ["-y", "mcp-local-rag"]

[mcp_servers.local-rag.env]
BASE_DIR = "/absolute/path/to/your/documents"
```

</details>

<details>
<summary>OpenCode</summary>

Ergänze `~/.config/opencode/opencode.json` (oder `opencode.jsonc`):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "local-rag": {
      "type": "local",
      "command": ["npx", "-y", "mcp-local-rag"],
      "environment": {
        "BASE_DIR": "/absolute/path/to/your/documents"
      }
    }
  }
}
```

</details>

<details>
<summary>Cursor</summary>

Ergänze `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "local-rag": {
      "command": "npx",
      "args": ["-y", "mcp-local-rag"],
      "env": {
        "BASE_DIR": "/absolute/path/to/your/documents"
      }
    }
  }
}
```

</details>

Starte den Client neu und lass ihn anschließend den Index aufbauen:

```text
Synchronisiere alle Dokumente im konfigurierten Stammverzeichnis und warte, bis der Vorgang abgeschlossen ist.
```

Bei der ersten Synchronisierung wird das Standard-Embedding-Modell heruntergeladen (etwa 90
MB). Bis der Import beginnt, können 1–2 Minuten vergehen. Spätere Durchläufe verwenden den
lokalen Cache.

Nach Abschluss der Synchronisierung kannst du zum Beispiel fragen:

```text
Was steht in der API-Dokumentation zur Authentifizierung?
```

### CLI-Schnellstart

So verwendest du die CLI ohne MCP-Client:

```bash
npx mcp-local-rag ingest ./docs/
npx mcp-local-rag query "Authentifizierungs-API"
```

Die CLI verwendet standardmäßig das aktuelle Verzeichnis als Stammverzeichnis. Führe beide
Befehle im selben Verzeichnis aus, damit sie denselben Standardindex verwenden, oder setze
`BASE_DIR` und `DB_PATH` ausdrücklich.

## Unterstützte Inhalte

| Eingabe | Import |
|---|---|
| PDF, DOCX, TXT, Markdown | Einzelne Datei importieren oder Verzeichnis synchronisieren |
| Bereits vom Client abgerufenes HTML | `ingest_data` |
| Im Speicher vorliegender Klartext oder Markdown | Mit `ingest_data` und einer stabilen Quellkennung |

Der Server ruft HTML nicht selbst ab. Ein MCP-Client kann eine Seite laden und ihr HTML an
`ingest_data` übergeben.

Excel, PowerPoint, einzelne Bilddateien und Quellcodedateien werden beim Dateiimport nicht
unterstützt. Für Abbildungen in PDFs kann optional ein lokales Vision-Modell verwendet werden.
Das ist weder OCR noch Bildsuche.

## Mit dem Index arbeiten

Synchronisiere den Index, nachdem du Dokumente hinzugefügt, geändert oder entfernt hast. Für
die Suche und das Nachlesen kannst du deinen MCP-Client zum Beispiel bitten:

```text
Suche in der Dokumentation nach dem Verhalten bei ERR_CONNECTION_REFUSED.
Lies auch die Abschnitte vor und nach diesem Treffer.
```

Du kannst auch einzelne Dateien oder bereits vom Client abgerufenes HTML importieren. Um einen
vorhandenen Eintrag neu aufzubauen, importiere das Dokument erneut mit demselben Pfad oder
derselben Quellkennung. `sync` überspringt unveränderte Dateien. MCP-Dateipfade müssen absolut
sein und innerhalb eines konfigurierten Stammverzeichnisses liegen.

Bei PDFs können die erkannten Abschnittsüberschriften fehlerhaft sein. Wenn du die genaue
Überschrift brauchst, prüfe sie auf der Originalseite.

<details>
<summary>MCP-Werkzeuge</summary>

| Werkzeug | Zweck |
|---|---|
| `sync_start` | Alle konfigurierten Stammverzeichnisse oder einen Pfad mit dem Index abgleichen |
| `sync_status` | Status einer laufenden Synchronisierung abrufen |
| `ingest_file` | Eine Datei importieren oder ersetzen |
| `ingest_data` | Bereits im Client vorliegenden Text, Markdown oder HTML importieren |
| `query_documents` | Mit semantischem Abgleich und Stichwortgewichtung suchen |
| `read_chunk_neighbors` | Benachbarte Abschnitte eines Suchtreffers lesen |
| `list_files` | Unterstützte Dateien und ihren Importstatus anzeigen |
| `delete_file` | Eine indexierte Datei oder einen `ingest_data`-Eintrag löschen |
| `status` | Status von Index und Suche anzeigen |

</details>

## CLI

Mit der CLI kannst du den Index aktualisieren, die Suche eingrenzen oder indexierte Inhalte
entfernen:

```bash
npx mcp-local-rag sync ./docs/
npx mcp-local-rag query "Authentifizierung" --scope /docs/api --scope /docs/guide
npx mcp-local-rag read-neighbors --file-path /abs/path.md --chunk-index 5
npx mcp-local-rag list
npx mcp-local-rag status
npx mcp-local-rag delete ./docs/old.pdf
npx mcp-local-rag delete --source "https://example.com/docs"
```

`ingest` importiert die ausgewählten Dateien. `sync` entfernt zusätzlich Einträge gelöschter
Dateien und überspringt unveränderte Dateien. Mit `--scope` beschränkst du Treffer auf ein
Pfadpräfix; wiederhole die Option, um mehrere Präfixe einzubeziehen.

Globale Optionen wie `--db-path`, `--cache-dir` und `--model-name` stehen vor dem Unterbefehl.
Optionen des Unterbefehls stehen dahinter:

```bash
npx mcp-local-rag --db-path ./my-db query "Authentifizierung"
```

`npx mcp-local-rag --help` zeigt die vollständige Befehlsreferenz.

`query` schreibt seine Ergebnisse als JSON nach stdout, den besten Treffer zuerst, sodass sie
sich per Pipe an ein anderes Werkzeug übergeben lassen. Die Definition der einzelnen Felder
steht in [`docs/schema/query-output.schema.json`](docs/schema/query-output.schema.json).

Wenn du ein Projekt verschieben und seinen Index behalten möchtest, beende zuerst den
MCP-Server und andere Schreibprozesse. Verschiebe die Dateien und die Datenbank zusammen, ohne
die Verzeichnisstruktur zu ändern, und führe dann diesen Befehl aus:

```bash
npx mcp-local-rag --db-path /new/project/lancedb relocate --from /old/project --to /new/project
```

Passe `BASE_DIR`/`BASE_DIRS`, `DB_PATH` und weitere betroffene Pfade in deiner MCP-Konfiguration
an und starte den Client neu.

## Agent Skills

[Agent Skills](https://agentskills.io/) geben KI-Assistenten Hinweise für Abfragen und Importe:

```bash
npx mcp-local-rag skills install --claude-code
npx mcp-local-rag skills install --claude-code --global
npx mcp-local-rag skills install --codex
```

Die installierten Skills behandeln Abfrageformulierung, Trefferverfeinerung und HTML-Import.
Falls ein Skill nicht automatisch aktiviert wird, bitte den Assistenten ausdrücklich darum, den
mcp-local-rag-Skill zu verwenden.

## Erweiterte Optionen

Beginne mit den Standardeinstellungen. Die folgenden Abschnitte helfen dir, wenn du mehrere
Stammverzeichnisse brauchst, die Suche an deinen Bestand anpassen oder PDF-Abbildungen
durchsuchbar machen möchtest.

<details>
<summary>Speicher und Stammverzeichnisse</summary>

Der MCP-Server liest Umgebungsvariablen. Die CLI unterstützt die aufgeführten Variablen und
Optionen. Verwende denselben `DB_PATH`, wenn mehrere Befehle denselben Index nutzen sollen.

| Umgebungsvariable | CLI-Option | Standard | Beschreibung |
|---------------------|----------|---------|-------------|
| `BASE_DIR` | `--base-dir` | Aktuelles Verzeichnis | Ein Stammverzeichnis; die CLI-Option kann bei `ingest`, `list` und `sync` mehrfach verwendet werden |
| `BASE_DIRS` | – | nicht gesetzt | JSON-Array mit Stammverzeichnissen; hat Vorrang vor `BASE_DIR` |
| `DB_PATH` | `--db-path` | `./lancedb/` | Pfad zur Vektordatenbank |
| `CACHE_DIR` | `--cache-dir` | `./models/` | Verzeichnis für den Modellcache |
| `HF_ENDPOINT` | – | `https://huggingface.co` | Endpunkt für Hugging-Face-Modelldownloads; bei blockierten Direktdownloads die URL eines Mirrors verwenden |
| `MAX_FILE_SIZE` | `--max-file-size` | `104857600` (100 MB) | Maximale Dateigröße in Byte |

Dateizugriffe bleiben auf die konfigurierten Stammverzeichnisse beschränkt. Für mehrere
Verzeichnisse setze `BASE_DIRS='["/absolute/docs","/absolute/specs"]'` oder wiederhole die
CLI-Option `--base-dir`. Es gilt: CLI-Stammverzeichnisse vor `BASE_DIRS`, vor `BASE_DIR`, vor
dem aktuellen Verzeichnis. Es zählt nur die Angabe mit der höchsten Priorität; die
Stammverzeichnisse aus verschiedenen Quellen werden nicht zusammengeführt. Ungültiges
`BASE_DIRS` führt zu einem Fehler. Relative Werte für `DB_PATH` und `CACHE_DIR` beziehen sich
auf das Arbeitsverzeichnis.

</details>

<details>
<summary>Modelle und Suchparameter</summary>

Wähle ein Embedding-Modell passend zur Sprache und zum Fachgebiet deiner Dokumente. Vergleiche
Einstellungen mit deinen tatsächlichen Fragen und prüfe, welche Textstellen gefunden werden.
Das Modell muss Mean Pooling und L2-Normalisierung unterstützen, da das Werkzeug damit die
Embeddings berechnet.

| Umgebungsvariable | CLI-Option | Standard | Beschreibung |
|---------------------|----------|---------|-------------|
| `MODEL_NAME` | `--model-name` | `Xenova/all-MiniLM-L6-v2` | Hugging-Face-Embedding-Modell |
| `CHUNK_MIN_LENGTH` | `--chunk-min-length` | `50` | Mindestlänge eines gewöhnlichen Abschnitts in Zeichen (1–10000); ein Teilstück, das beim Teilen für das Token-Limit des Modells entsteht, darf kürzer sein |
| `EMBED_TITLE_PREFIX` | – | `false` | Ergänzt die Embedding-Eingabe jedes Abschnitts um den Dokumenttitel |
| `EMBED_HEADING_PREFIX` | – | `false` | Ergänzt die Embedding-Eingabe jedes Abschnitts um die Überschriftenhierarchie, sofern sie hineinpasst |
| `RAG_DEVICE` | – | `cpu` | ONNX-Runtime-Ausführungsgerät |
| `RAG_DTYPE` | – | `fp32` | An das ausgewählte Modell übergebener Embedding-Datentyp |
| `RAG_EMBEDDING_PROVIDER` | – | `local` | `local` nutzt Transformers.js; `openai` einen OpenAI-kompatiblen Embedding-Endpunkt |
| `RAG_OPENAI_BASE_URL` | – | (bei `openai` erforderlich) | Basis-URL des OpenAI-kompatiblen Embedding-Dienstes |
| `RAG_OPENAI_API_KEY` | – | nicht gesetzt | Optionales Bearer-Token für den Embedding-Dienst |
| `RAG_OPENAI_TIMEOUT_MS` | – | `60000` | Zeitlimit für Embedding-Anfragen in Millisekunden |

Beide Präfixoptionen sind standardmäßig `false` und unabhängig voneinander nutzbar. Probiere
`EMBED_TITLE_PREFIX`, wenn einem Abschnitt das übergeordnete Dokumentthema fehlt, oder
`EMBED_HEADING_PREFIX`, wenn er das Thema seines Kapitels braucht. Beide zusammen liefern nicht
immer bessere Treffer. Sie beeinflussen die Embeddings, nicht den zurückgegebenen Text oder den
Stichwortindex; Überschriftenkontext entfällt, wenn er das Eingabelimit überschreiten würde.

Erstelle bei einem Wechsel des Embedding-Modells einen neuen Index unter einem neuen `DB_PATH`.
Vektoren verschiedener Modelle sind auch bei gleicher Dimension nicht vergleichbar. Nach einer
Änderung von `RAG_DTYPE` oder einer Präfixoption musst du alle indexierten Dokumente erneut
importieren, bevor du suchst. `sync` überspringt unveränderte Dateien.

Die CLI liest keine MCP-Client-Konfiguration. Verwende bei einem gemeinsamen Index dasselbe
Modell, denselben `RAG_DTYPE` und dieselben Präfixeinstellungen für Import und Suche. Ein
Wechsel von `RAG_DEVICE` allein erfordert keinen neuen Index.

Abschnitte und Suchanfragen bleiben auf diesem Rechner, solange `RAG_EMBEDDING_PROVIDER` nicht
`openai` ist. Dann sind `RAG_OPENAI_BASE_URL` und `MODEL_NAME` (oder `--model-name`)
erforderlich. Lege `DB_PATH` auf einen neuen Index, weil Vektoren eines anderen Modells nicht
mit dem lokalen Standard vergleichbar sind.

```bash
RAG_EMBEDDING_PROVIDER=openai \
RAG_OPENAI_BASE_URL=http://host:port/v1 \
MODEL_NAME=<embedding-model-id> \
DB_PATH=./lancedb-openai \
npx mcp-local-rag sync
```

Der HTTP-Anbieter normalisiert die Vektoren mit L2. Er kann den entfernten Tokenizer nicht
prüfen, daher entfallen die exakte Token-Begrenzung und die dauerhaften Embedding-Snapshots.

### Suchparameter

Die ersten vier Einstellungen in der Tabelle gelten für MCP und CLI. Wenn exakte Begriffe
stärker zählen sollen, erhöhe versuchsweise `RAG_HYBRID_WEIGHT` und vergleiche die Treffer
anhand deiner eigenen Fragen. Das externe Neuordnen ist nur über MCP verfügbar.

| Variable | Standard | Beschreibung |
|----------|---------|-------------|
| `RAG_HYBRID_WEIGHT` | `0.6` | Gewicht der Stichworttreffer (0.0–1.0). 0 deaktiviert die Stichwortgewichtung, 1 verwendet das höchste Gewicht. |
| `RAG_GROUPING` | nicht gesetzt | `similar` behält die erste Relevanzgruppe; `related` behält bis zu zwei Gruppen und trennt sie an deutlichen Sprüngen der Vektordistanz. |
| `RAG_MAX_DISTANCE` | nicht gesetzt | Filtert wenig relevante Treffer heraus, zum Beispiel mit `0.5`. |
| `RAG_MAX_FILES` | nicht gesetzt | Beschränkt die Treffer auf die besten N Dateien, zum Beispiel mit `1` auf die beste Datei. |
| `RAG_RERANK_URL` | nicht gesetzt | Nur MCP: Basisadresse eines Text-Embeddings-Inference-Servers. Der Server sendet an `{url}/rerank`. |
| `RAG_RERANK_CMD` | nicht gesetzt | Nur MCP: externer Befehl; `{query}` übergibt die Suchanfrage, `{top}` die angeforderte Trefferzahl. |
| `RAG_RERANK_TIMEOUT_MS` | `10000` | Zeitbudget pro Neuordnung in Millisekunden (100–600000). |

### HTTP-Neuordnung (`RAG_RERANK_URL`)

Setze diese Variable auf die Basisadresse eines [Text Embeddings Inference](https://github.com/huggingface/text-embeddings-inference)-Neuordners, zum Beispiel `http://host:8002`. Suchanfrage und Kandidatentexte gehen an `{url}/rerank`. Setze diese Variable oder `RAG_RERANK_CMD`, nicht beide.

`score` ist der Rang in dieser Antwort; ein kleinerer Wert ist besser. `rerankScore` behält die Bewertung des Dienstes. Bei Fehler, Zeitüberschreitung oder unbrauchbarer Antwort bleibt die ursprüngliche Reihenfolge. Die Textstellen verlassen diesen Rechner nur, wenn die Adresse gesetzt ist. Der Server holt dreimal so viele Treffer, wie angefordert wurden, und gibt danach wieder die angeforderte Anzahl zurück. Er durchsucht den Index nicht zusätzlich. Eine Textstelle, die die erste Stufe hoch bewertet hat, kann nach unten rutschen oder entfallen.

### Externes Neuordnen (`RAG_RERANK_CMD`)

Der Befehl erhält die Suchtreffer samt Text über die Standardeingabe. Ruft er einen entfernten
Dienst auf, kann dieser Text den Rechner verlassen.

Gib die ausführbare Datei und die vollständige Argumentvorlage an. Setze `{query}` und `{top}`
dort ein, wo der Befehl die Suchanfrage und die Anzahl der Ergebnisse erwartet. Einfache oder
doppelte Anführungszeichen fassen Pfade oder Argumente mit Leerzeichen zusammen, und
Backslashes bleiben wörtlich. Der Server startet die ausführbare Datei ohne Shell, deshalb
lässt sich ein von npm installierter `.cmd`-Wrapper unter Windows nicht starten.

```json
{
  "env": {
    "RAG_RERANK_CMD": "/path/to/reranker --query {query} --top {top}",
    "RAG_RERANK_TIMEOUT_MS": "10000"
  }
}
```

Der Befehl muss Ergebnisse im Format des [Ausgabeschemas](docs/schema/query-output.schema.json)
lesen und zurückgeben. Er kann Treffer entfernen, umsortieren oder deren Text ändern. Der
Server gibt seine Ausgabe zurück.

Die ursprüngliche Reihenfolge bleibt erhalten, wenn der Befehl fehlschlägt, das Zeitlimit
überschreitet oder eine Antwort zurückgibt, die nicht dem Schema entspricht.

</details>

<details>
<summary>PDF-Abbildungen und gespeicherte Bilder</summary>

Standardmäßig indexiert der Import nur Text. Für PDF-Abbildungen kannst du lokale
Bildbeschreibungen mit `visual: true` in MCP oder `--visual` in der CLI aktivieren. Die
Beschreibungen sind weder OCR noch wortgetreue Transkriptionen.

`fast` (Standard) lädt bei der ersten Verwendung etwa 250 MB herunter. Für Beschriftungen und
Text innerhalb von Abbildungen eignet sich `quality`; dafür werden etwa 1,7 GB heruntergeladen,
und die Verarbeitung dauert länger.

Wähle das Profil mit `visualQuality: "quality"` in MCP oder `--visual-quality quality` in der
CLI.

```bash
npx mcp-local-rag ingest ./docs/paper.pdf --visual --visual-quality quality
```

Um Bilder zusammen mit passenden Texttreffern zurückzugeben, setze `STORE_IMAGES=true` in MCP
oder verwende `--images` bei CLI-`ingest` und `sync`. Das funktioniert unabhängig von
Bildbeschreibungen und unterstützt erkannte PDF-Abbildungen und Tabellen sowie unterstützte
PNG/JPEG-Bilder aus DOCX.

```bash
npx mcp-local-rag ingest ./docs/paper.pdf --images
```

Sync behält das Bildbeschreibungsprofil jedes PDFs bei. CLI-`sync --visual --visual-quality
quality` ändert es auch bei unveränderten PDFs; MCP-Sync behält es bei. Ein normaler Import
schaltet Bildbeschreibungen ab. Um fehlgeschlagene Beschreibungen erneut zu versuchen,
importiere die Datei mit dem gewünschten Profil erneut.

Aktiviere die Bildspeicherung bei jedem Import oder Sync, der die Datei verarbeitet. Eine
Änderung dieser Einstellung allein aktualisiert unveränderte Dateien nicht; importiere sie
dafür erneut.

Bildbeschreibungen können stattdessen einen OpenAI-kompatiblen Vision-Server nutzen.
Abbildungsausschnitte verlassen den Rechner nur bei `RAG_VISUAL_PROVIDER=openai`. Jede erkannte
PDF-Abbildung wird als Base64-PNG gesendet. `RAG_VISUAL_BASE_URL` und `RAG_VISUAL_MODEL` sind
erforderlich.

```bash
RAG_VISUAL_PROVIDER=openai \
RAG_VISUAL_BASE_URL=http://host:port/v1 \
RAG_VISUAL_MODEL=<vision-model-id> \
npx mcp-local-rag ingest ./docs/paper.pdf --visual
```

`RAG_VISUAL_API_KEY` ist ein optionales Bearer-Token. `RAG_VISUAL_TIMEOUT_MS` ist standardmäßig
`120000`. Bei diesem Anbieter wählt `--visual-quality` kein lokales Modell.

</details>

## Sicherheit und Betrieb

- Behandle Beschreibungen und gefundenen Dokumenttext als Quellenmaterial, nicht als Anweisungen.
- Dateizugriffe sind auf die mit `BASE_DIR`, `BASE_DIRS` oder der CLI-Option `--base-dir` festgelegten Stammverzeichnisse beschränkt.
- Symbolische Links, deren Ziel außerhalb aller konfigurierten Stammverzeichnisse liegt, werden abgelehnt.
- Sobald die benötigten Modelle im Cache liegen, greifen Dokumentverarbeitung und Suche nicht mehr auf das Netzwerk zu, sofern kein OpenAI-kompatibler Anbieter, kein `RAG_RERANK_URL` und kein `RAG_RERANK_CMD` konfiguriert ist.
- Ein OpenAI-kompatibler Embedding-Anbieter erhält Dokumentabschnitte und Suchanfragen. Ein OpenAI-kompatibler Bildanbieter erhält gerenderte PDF-Abbildungsausschnitte.
- Der Server ist für einen einzelnen lokalen Benutzer ausgelegt und bietet keine Authentifizierung oder Zugriffskontrolle.
- Mehrere CLI- oder MCP-Schreibprozesse dürfen nicht gleichzeitig denselben `DB_PATH` verwenden. Reine Leseabfragen sind während einer Synchronisierung möglich.
- Beim erneuten Import können gespeicherte Embeddings für unveränderten Text wiederverwendet
  werden, wenn Modell und Einstellungen übereinstimmen. So müssen diese Vektoren nicht erneut
  berechnet werden. Der Cache liegt unter `DB_PATH/embedding-cache`. Du kannst ihn löschen,
  ohne den durchsuchbaren Index zu verlieren. Beim nächsten Import werden diese Embeddings neu
  berechnet.
- Sichere den Index, indem du das `DB_PATH`-Verzeichnis kopierst, während kein Schreibprozess läuft.

<details>
<summary><strong>Fehlerbehebung</strong></summary>

### "No results found"

Dokumente müssen zuerst importiert werden. Prüfe den Importstatus mit `"Liste alle importierten
Dateien auf"`. Fehlen nach einem Sync die Treffer, prüfe, ob Import und Suche denselben
absoluten `DB_PATH` verwenden. Ein relativer Pfad kann auf einen anderen Index zeigen.

### Modelldownload fehlgeschlagen

Prüfe die Internetverbindung. Wenn du einen Proxy verwendest, kontrolliere die
Netzwerkeinstellungen. Das Modell kann auch [manuell
heruntergeladen](https://huggingface.co/Xenova/all-MiniLM-L6-v2) werden.

### "File too large"

Die Standardgrenze beträgt 100 MB. Teile die Datei auf oder erhöhe `MAX_FILE_SIZE`.

### Langsame Abfragen

Prüfe die Anzahl der Abschnitte mit `status`. Große Dokumente mit vielen Abschnitten können
Abfragen verlangsamen. Sehr große Dateien sollten gegebenenfalls geteilt werden.

### "Path outside BASE_DIR"

Der Dateipfad muss innerhalb eines konfigurierten Stammverzeichnisses liegen: `BASE_DIR`, ein
Eintrag aus `BASE_DIRS` oder ein über `--base-dir` gesetzter Pfad. Verwende einen absoluten
Pfad.

### "BASE_DIRS must be a JSON array..."

`BASE_DIRS` akzeptiert ein JSON-Array mit einem oder mehreren nicht leeren Pfaden:

- Gültig: `BASE_DIRS='["/Users/me/work","/Users/me/specs"]'`
- Ungültig: `BASE_DIRS=/a:/b` (Trennzeichensyntax wird nicht unterstützt)
- Ungültig: `BASE_DIRS='[]'` (leeres Array)

### MCP-Client zeigt keine Werkzeuge an

1. Syntax der Konfigurationsdatei prüfen
2. Client vollständig beenden und neu starten (bei Cursor auf dem Mac mit Cmd+Q)
3. Direkt testen: `npx mcp-local-rag` sollte ohne Fehler starten

</details>

## Mitwirken

Beiträge sind willkommen. Hinweise zur Einrichtung und zu den Richtlinien stehen in
[CONTRIBUTING.md](CONTRIBUTING.md).

## Lizenz

MIT-Lizenz. Kostenlose Nutzung für private und kommerzielle Zwecke.

## Blogbeiträge

- [Building a Local RAG for Agentic Coding](https://www.norsica.jp/blog/local-rag-agentic-coding): Technischer Einblick in semantische Aufteilung und hybride Suche.

## Danksagung

Erstellt mit dem [Model Context Protocol](https://modelcontextprotocol.io/) von Anthropic,
[LanceDB](https://lancedb.com/) und
[Transformers.js](https://huggingface.co/docs/transformers.js).
