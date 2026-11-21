# Rediseño de la interfaz

Plan para rediseñar la UI del simulador con [Hallmark](https://github.com/nutlope/hallmark) (skill de diseño anti-"AI slop") **sin tocar el cableado**: mismo estado, mismo cálculo, mismos tests.

Rama de trabajo: **`redesign-app`** (creada desde master `dc62dd9`, con el Tramo A + B ya mergeados).

> **Regla de oro:** el wiring es intocable. La única garantía de que no rompemos nada son los 16 tests en verde (`npm test`) y que la app siga calculando lo mismo en el navegador.

---

## Progreso

| Fase | Tarea | Estado |
|---|---|---|
| **0 · Instalar Hallmark** | `npx skills add nutlope/hallmark` (sin `-g`, en el repo) y commitear | ✅ Hecho (`75d99e2`) |
| | Leer su `SKILL.md`: dónde cae, cómo se invoca en OpenCode, cómo maneja React+Vite (¿escribe en `style.css`/JSX o genera HTML aparte?) | ✅ Hecho — ver "Hallmark en nuestro stack" abajo |
| | Decidir `puppeteer-core` + Chrome para `sloplint --render` (sin ello solo corren checks estáticos) | ✅ Hecho (`460e407`) — local como devDependency; Chrome ya en la máquina |
| | Línea en `AGENTS.md`: *"para diseño, usar hallmark"* | ✅ Hecho (`680ab32`) |
| **1 · Alcance** | Delimitar qué se toca y qué no (ver abajo) — decisión mía | ✅ Hecho — fijado abajo |
| **2 · Tema vs custom** | Mirar los 50 temas en usehallmark.com y elegir tema concreto o modo custom — decisión del propietario | ✅ Hecho — opción 3: deal `r0` (seed `spanish-mortgage-simulator-calculate-834f·eb2e0889·2026-11-21·r0`), elegido **Almanac** (1/3) |
| **3 · Rediseñar** | `--before` con dev server → rediseño siguiendo Hallmark → sweep `--kept` | ⬜ Pendiente |
| **4 · Puerta de verificación** | `npm test` → `npm run build` → `sloplint --render` en verde → revisar en navegador → push → **deploy en Vercel** → PR | ⬜ Pendiente |

**Leyenda:** ⬜ Pendiente · 🔵 En curso · ✅ Hecho

---

## Fase 0 · Instalar Hallmark en el repo

Instalación **en el proyecto (sin `-g`)** y commiteada, para que cualquiera que clone (incluidas las ramas personales) lo tenga y quede versionado.

### Hallmark en nuestro stack (leído del `SKILL.md` + `references/`)

- **Invocación en OpenCode:** `/hallmark` (el skill ya está en la lista: `.agents/skills/hallmark`). Preguntas en texto plano, subagentes `@general` permitidos.
- **Nuestro caso es un "app screen"** (una herramienta, no una landing): a *full depth* recomponen la pantalla dentro de su shell, **sin hero stage ni hero review**.
- **Vite:** el tier de render va contra el dev server: `sloplint src/ --render --url http://localhost:5173/`. El tier estático lee también `.jsx` (detecta colores inline, `transition-all`, etc.).
- **`redesign <path>`** = *full*: conserva contenido y wiring (campos, handlers, ids, tests), cambia sistema y composición. **En un redesign la stylesheet es suya para editar**; la regla *append-only* protege solo contra builds nuevos.
- **`--before`** (registro inicial) y **`--kept`** (falla si algo desapareció): la contraparte de nuestra puerta.
- **Puppeteer:** `puppeteer-core@25` como devDependency + Chrome del sistema (`/Applications/Google Chrome.app`). Sin Chrome en otra máquina, solo tier estático — nunca claim de un render que no corrió.
- **Baseline estático (2026-11-21):** `30 FAIL · 19 REFLEX · 3 WARN` en `src/` — colores literales fuera de tokens, spacing fuera de la escala de 4px, contraste del botón a 2.26:1. Es el punto de partida, no una regresión.

## Fase 1 · Alcance (criterio del asistente)

- **Se toca:** `src/style.css`, estructura de JSX si hace falta, `index.html` (head/meta).
- **Intocables:**
  - `src/state.js` — el reducer y el estado.
  - `src/lib/simulation.js` — la frontera estable con tests.
  - Lógica de `src/App.jsx` (el wiring del reducer/fetch).
  - `test/*` — los 16 tests no se tocan.
  - `public/escenario.json` — datos de cada rama.
  - `vercel.json`, `vite.config.js`.
- La UI **sigue en español**; identificadores y comentarios en inglés (regla del repo).
- Si Hallmark propone textos de marketing nuevos: solo en portada/desc, **nunca inventar datos de producto** (gate Floor de ellos ya lo prohíbe).

## Fase 2 · Tema vs custom (decisión del propietario)

- Mirar los 50 temas en [usehallmark.com](https://www.usehallmark.com) y elegir: un tema concreto o modo **custom** (diseño desde un prompt, sin receta de tema).
- Los temas son "materiales", no planes: dos prompts en el mismo tema dan páginas distintas.

## Fase 2 · Tema vs custom — ✅ Almanac (1/3)

Tercera opción (deal y elegir entre 3): `theme.mjs deal --genre editorial` con seed `spanish-mortgage-simulator-calculate-834f·eb2e0889·2026-11-21·r0` repartió **Almanac / Broadside / Carnival**. Elegido **Almanac**:

- **Por qué:** material de tabla — "cool slate stock, cifras en mono alineadas al decimal, dos grosores de filete". Nuestro producto *es* una tabla de números; el registro de "libro de referencia / extracto" transmite precisión, que es lo que busca quien calcula su hipoteca. Pictured as **Workbench** (herramienta de trabajo), que es lo que es la app.
- **Descartados:** Broadside (cartel de subasta, ruidoso) y Carnival (demasiado lúdico para finanzas).
- **Tokens clave:** paper slate `oklch(84% 0.012 245)`, ink azul-negro, magenta de gráfico `oklch(45% 0.180 350)` (<5% de la pantalla), Hanken Grotesk (heads) + Newsreader (prosa) + IBM Plex Mono (cifras `tabular-nums`), esquinas rectas, **sin sombras ni cards**, dos pesos de filete.
- **Do-nots:** nunca hot pink/violeta, nunca papel cálido, nunca card encajada ni sombra, cifras comparables siempre mono tabular alineadas a la derecha.

## Fase 3 · Rediseñar

- Trabajar en `redesign-app`.
- Seguir el flujo de Hallmark: pre-flight → deal de temas → **hero construido y revisado en frío antes que el resto** → sloplint a 8 anchos → revisor con contexto limpio.
- No salirse del alcance de la Fase 1 aunque el skill sugiera reestructurar lógica.

## Fase 4 · Puerta de verificación

Como siempre en este repo (no hay CI; cada push despliega):

1. `npm test` → 16/16 en verde (los tests de lógica demuestran que el wiring sobrevive).
2. `npm run build` → OK, `dist/` con `escenario.json`.
3. `sloplint --render` en verde + `--kept` confirma que ningún campo/handler/heading se perdió.
4. Revisión manual en navegador: la app **carga el escenario, calcula y muestra la tabla** igual que antes.
5. Push → **comprobar el deploy en Vercel** (no solo local) → PR.

---

## Comandos

```bash
npm test          # 16 tests: simulación + UI
npm run build     # errores de import/JSX + dist/
node skills/hallmark/scripts/sloplint.mjs <ruta> --render   # lint de diseño (según Fase 0)
```
