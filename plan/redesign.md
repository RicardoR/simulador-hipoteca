# Rediseño de la interfaz

Plan para rediseñar la UI del simulador con [Hallmark](https://github.com/nutlope/hallmark) (skill de diseño anti-"AI slop") **sin tocar el cableado**: mismo estado, mismo cálculo, mismos tests.

Rama de trabajo: **`redesign-app`** (creada desde master `dc62dd9`, con el Tramo A + B ya mergeados).

> **Regla de oro:** el wiring es intocable. La única garantía de que no rompemos nada son los 16 tests en verde (`npm test`) y que la app siga calculando lo mismo en el navegador.

---

## Progreso

| Fase | Tarea | Estado |
|---|---|---|
| **0 · Instalar Hallmark** | `npx skills add nutlope/hallmark` (sin `-g`, en el repo) y commitear | ⬜ Pendiente |
| | Leer su `SKILL.md`: dónde cae, cómo se invoca en OpenCode, cómo maneja React+Vite (¿escribe en `style.css`/JSX o genera HTML aparte?) | ⬜ Pendiente |
| | Decidir `puppeteer-core` + Chrome para `sloplint --render` (sin ello solo corren checks estáticos) | ⬜ Pendiente |
| | Línea en `AGENTS.md`: *"para diseño, usar hallmark"* | ⬜ Pendiente |
| **1 · Alcance** | Delimitar qué se toca y qué no (ver abajo) — decisión mía | ⬜ Pendiente |
| **2 · Tema vs custom** | Mirar los 50 temas en usehallmark.com y elegir tema concreto o modo custom — decisión del propietario | ⬜ Pendiente |
| **3 · Rediseñar** | Aplicar el rediseño en `redesign-app` siguiendo lo que dictamine Hallmark | ⬜ Pendiente |
| **4 · Puerta de verificación** | `npm test` → `npm run build` → `sloplint` en verde → revisar en navegador → push → **deploy en Vercel** → PR | ⬜ Pendiente |

**Leyenda:** ⬜ Pendiente · 🔵 En curso · ✅ Hecho

---

## Fase 0 · Instalar Hallmark en el repo

Instalación **en el proyecto (sin `-g`)** y commiteada, para que cualquiera que clone (incluidas las ramas personales) lo tenga y quede versionado.

1. `npx skills add nutlope/hallmark` → verificar dónde cae y añadirlo a git.
2. **Leer `SKILL.md` antes de diseñar nada.** Puntos a confirmar:
   - Cómo se invoca en OpenCode (`/hallmark <prompt>` o nombrándolo).
   - Cómo materializa el resultado en un stack **React + Vite** (sus builds son HTML/CSS autocontenidos; lo suyo es que rediseñe CSS/estructura manteniendo el JSX — confirmarlo).
   - Los gates: Floor (nunca se envía roto), Reflex (defaults de modelo, justificables), Finish (craft, no bloquea).
3. Decidir si instalamos `puppeteer-core` global + Chrome para `sloplint --render` (screenshots y checks a 8 anchos). Sin ello, solo checks estáticos.
4. Añadir a `AGENTS.md` que para trabajo de diseño se usa hallmark.
5. Commit: `chore: add hallmark design skill`.

> **Nota:** los checks de Hallmark con `--before`/`--kept` encajan con nuestra puerta: registran enlaces, campos, handlers y headings antes del rediseño y fallan si alguno desaparece.

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
