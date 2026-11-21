# Rediseño de la interfaz

Plan para rediseñar la UI del simulador con [Hallmark](https://github.com/nutlope/hallmark) (skill de diseño anti-"AI slop") **sin tocar el cableado**: mismo estado, mismo cálculo, mismos tests.

Rama de trabajo: **`redesign-app`** (creada desde master `dc62dd9`, con el Tramo A + B ya mergeados).

> **Regla de oro:** durante el rediseño, el wiring y el cálculo permanecen estables. La garantía son los tests del simulador en verde y que la app calcule lo mismo en el navegador.

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
| **3 · Rediseñar** | `--before` con dev server → rediseño siguiendo Hallmark → sweep `--kept` | ✅ Hecho — Almanac aplicado a la pantalla de trabajo; wiring conservado |
| **4 · Puerta de verificación** | `npm test -- test/` → `npm run build` → `sloplint --render` en verde → revisar en navegador → push → **deploy en Vercel** → PR | 🔵 En curso — tests, build, render y finish review completados; queda revisión del propietario y deploy |
| **Anexo · Mejoras extras** | Campo numérico Euríbor y selectores con estilo Almanac | ✅ Hecho — ver alcance y validación al final |

**Leyenda:** ⬜ Pendiente · 🔵 En curso · ✅ Hecho

### Estado al parar (sesión 2026-11-21)

- **Rama:** `redesign-app`. Rediseño en `85f21fb`; mejoras extras en implementación, sin push para que el propietario revise primero.
- **Fase 0 ✅, Fase 2 ✅ y Fase 3 ✅.** Tema **Almanac** (deal seed `spanish-mortgage-simulator-calculate-834f·eb2e0889·2026-11-21·r0`).
- **Fase 3:** composición de herramienta en tres columnas, formularios y tabla en español, valores numéricos tabulares y rangos EURIBOR plegables en móvil. En esa fase no se tocaron `src/state.js`, `src/lib/simulation.js` ni `test/*`.
- **`--kept`:** 33/33 campos, 12/12 handlers y 1/1 heading conservados. El único WARN es `figures 0/1`: el inventario renderiza al ancho móvil, donde la sección EURIBOR está cerrada, igual que en el baseline; los controles y sus 25 pares año/valor siguen presentes y visibles en desktop.
- **Verificación Fase 3:** `npm test -- test/` → 16/16; `npm run build` → OK y `dist/escenario.json` presente; Hallmark `--render --kept` → 0 FAIL, 0 REFLEX, 1 WARN descrito arriba.
- **Finish review (subagent):** 2 hallazgos, 2 resueltos — acción Calcular ahora activa con Space y la descripción vuelve a mencionar la comparación de escenarios y las amortizaciones parciales.
- **Finish review de las mejoras extra:** 1 hallazgo, 1 resuelto — los borradores Euríbor ya no bloquean una hipoteca fija y se limpian al cambiar a ese tipo.
- **`npm test` sin argumentos** también descubre suites de prueba internas de `.agents/skills/hallmark/`; cinco fallan por su entorno (`import.meta.url` y una suite sin tests). `npm test -- test/` ejecuta solo las pruebas del simulador.
- **Anexo extras:** implementados el input numérico Euríbor con validación y bloqueo al calcular si queda inválido, y el skin Almanac para los `<select>` nativos. `src/lib/simulation.js` no se modificó.
- **Pendiente:** revisión del propietario; después push → comprobar deploy Vercel → PR. No se ha hecho push.

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

- **Alcance de Fase 3:** `src/style.css`, estructura de JSX si hace falta, `index.html` (head/meta).
- **Intocables:**
  - `src/state.js` — el reducer y el estado.
  - `src/lib/simulation.js` — la frontera estable con tests.
  - Lógica de `src/App.jsx` (el wiring del reducer/fetch).
  - `test/*` — los tests existentes no se tocan durante Fase 3.
  - `public/escenario.json` — datos de cada rama.
  - `vercel.json`, `vite.config.js`.
- Esta restricción protege el rediseño de Fase 3; las mejoras del anexo se implementan como tarea separada y pueden ampliar estado/UI y tests, pero no el motor de simulación.
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

1. `npm test -- test/` → suite del simulador en verde (los tests de lógica demuestran que el wiring sobrevive).
2. `npm run build` → OK, `dist/` con `escenario.json`.
3. `sloplint --render` en verde + `--kept` confirma que ningún campo/handler/heading se perdió.
4. Revisión manual en navegador: la app **carga el escenario, calcula y muestra la tabla** igual que antes.
5. Push → **comprobar el deploy en Vercel** (no solo local) → PR.

---

## Comandos

```bash
npm test -- test/ # tests del simulador: lógica + UI
npm run build     # errores de import/JSX + dist/
node skills/hallmark/scripts/sloplint.mjs <ruta> --render   # lint de diseño (según Fase 0)
```

---

## Anexo · Mejoras extras

Implementadas como tarea posterior e independiente del rediseño:

### 1. Valor editable para cada año del Euríbor

- **Hecho:** campo numérico junto a cada slider, ambos sincronizados con `euriborOverrides`; la simulación usa el último valor válido.
- Conserva límites y paso (`-0.5` a `15`, `0.1`), formato de dos decimales y validación de entradas vacías, parciales o fuera de rango. En hipotecas variables, un valor inválido marca el control y bloquea el cálculo; al cambiar a tipo fijo se descarta solo el borrador inválido y se conserva el último valor válido.
- Tests cubren edición directa, sincronización, formato, valores inválidos y cálculo con la tasa introducida.

### 2. Selectores con aspecto Almanac

- **Hecho:** `<select>` nativo con fondo, borde y chevrón personalizados; conserva teclado, foco y accesibilidad del navegador. La lista desplegable sigue usando la presentación del sistema operativo.
- Una lista emergente totalmente personalizada queda fuera de alcance; requeriría implementar y probar navegación por teclado, foco, Escape, selección y semántica para lectores de pantalla.
- Valores, IDs y handlers de los selectores existentes se conservan.
- **Verificación:** 18/18 tests del simulador y build correctos; el sweep renderizado conserva 0 FAIL y 0 REFLEX. Se mantiene el WARN de `--kept` documentado arriba (EURIBOR plegado en móvil, como en el baseline).
