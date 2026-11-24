# Arreglos, tests, docs y pulido

Plan para corregir los bugs detectados en el análisis de 2026-11-22, cerrar los
huecos de cobertura de tests, actualizar la documentación y pulir accesibilidad,
rendimiento e higiene del repo.

Rama de trabajo: **`fix-and-polish`** (creada desde master `44aac14`, limpio).

> **Regla de oro:** `src/lib/simulation.js` es la frontera estable. Se puede tocar
> — el propietario lo ha aprobado — **solo con tests primero**: primero se añaden
> tests de caracterización que fijen el comportamiento actual, después se corrige.
> La garantía son los tests en verde y que la app calcule lo mismo en el navegador
> salvo los casos deliberadamente corregidos.

---

## Progreso

| Fase | Tarea | Estado |
|---|---|---|
| **0 · Red de seguridad** | `vite.config.js`: `test.include` para que `npm test` no descubra los tests del skill Hallmark | ✅ Hecho |
| | Tests unitarios de `state.js` (hoy **cero**) fijando el comportamiento actual | ✅ Hecho (`test/state.test.js`, 36 tests) |
| | Tests de caracterización de `simulation.js` para **tipo variable** y **periodo inicial** (hoy no cubiertos) | ✅ Hecho (5 tests) |
| **1 · Bugs de validación** | Campo inválido **oculto** bloquea CALCULAR sin indicio visual (`state.js:230`) | ✅ Hecho (gateado por tipo en `hasInvalidFields`) |
| | `initialPeriodMonths` **sin máximo**: ≥ plazo desactiva en silencio todo el tipo variable (`state.js:60`) | ✅ Hecho (regla cruzada con el plazo, también en `applyScenario`) |
| | Espacios en blanco validan como 0 % (`parseFloatField`, `state.js:69`) | ✅ Hecho |
| | `1.5` en Capital se interpreta como 15 (`parseIntField`, `state.js:64`) — **decidido: solo enteros** | ✅ Hecho (incluye Plazo como regla `int` e importes de escenario marcados) |
| **2 · Bugs de cálculo** | Cabeceras con **año fraccionario** ("Año 2027.5") (`simulation.js:143`) | ✅ Hecho (`Math.floor`) |
| | Falta la **cabecera del último año parcial** → la tabla parece terminar un año antes | ✅ Hecho (fila `kind: 'end'` "Fin del préstamo") |
| | Semántica de `initialPayment` con amortización tipo `payment` en mes 1 — **decidido: cuota original** | ✅ Hecho (captura antes del bucle) |
| | Robustez de la lib: euríbor vacío en tipo variable → NaN (inalcanzable desde UI) | ✅ Hecho (serie ausente → euríbor 0) |
| **3 · Tests nuevos** | Casos límite de simulación + tests de UI faltantes (teclado, borrar amortización, `startYear`, `startDate` inválido) | ✅ Hecho (capital 0 y consistencia ya en Fases 0/2; nuevos: plazo 1 año, teclado, eliminar, importe inválido, Inicio, escenario malformado) |
| **4 · Accesibilidad y perf** | "Calcular": `<a role="button">` → `<button>` real con `aria-disabled` | ⬜ Pendiente |
| | Nombres accesibles de "Eliminar" (hoy todos dicen lo mismo) | ⬜ Pendiente |
| | `aria-describedby` en los campos con error | ⬜ Pendiente |
| | Memoización de la tabla (≤600 filas) y del bloque Euríbor (100 inputs) | ⬜ Pendiente |
| | Unificar la presentación de error (clase + `aria-invalid` + estilo inline, triplicado) | ⬜ Pendiente |
| **5 · Limpieza y docs** | CSS muerto (`[aria-disabled]`, `.is-success`, utilidades de `base.css`, bloque duplicado) | ⬜ Pendiente |
| | `AGENTS.md` (nombres de componentes, "16 tests", `npm test -- test/`), `simulation.js:8`, `state.js:16` | ⬜ Pendiente |
| | `.idea/` fuera del tracking + `.gitignore`; exports sin usar de `state.js`; `README.md` | ⬜ Pendiente |
| | Casillas de `plan/redesign-personal-branches.md` y Fase 4 de `plan/redesign.md` (trabajo ya hecho) | ⬜ Pendiente |

**Leyenda:** ⬜ Pendiente · 🔵 En curso · ✅ Hecho

---

## Contexto del análisis

Hallazgos verificados ejecutando el código real, no solo por lectura. Fuentes:
`src/state.js`, `src/lib/simulation.js`, `src/components/*.jsx`, `src/App.jsx`,
`src/style.css`, `test/*`, configuración y planes existentes.

### El orden de amortización **no** es un problema

Escenario real de `create-own-amortizations` (71.000 €, 15 años, inicio
2023-06, periodo inicial fijo 60 meses al 2,25 %, 6 amortizaciones):

| Orden | Meses | Final | Intereses |
|---|---|---|---|
| Amortización antes de intereses (**actual**) | 120 | mayo **2033** | 6.642,32 € |
| Intereses antes de amortización (estilo banco) | 119 | abril **2033** | 6.666,22 € |

Los dos órdenes terminan en 2033; la diferencia es ~24 € y un mes. La decisión
del propietario (documentada en `plan/fix-issues-and-refactor.md:221`) **se
mantiene**.

### Por qué "parece" que termina en 2032

La tabla solo pinta la cabecera de año cuando hay revisión de euríbor
(`simulation.js:147-154`). La última que llega a renderizarse es la del mes 108
→ `Año 2032`; el bucle termina en el mes 119, así que **la cabecera del año 10
(2033) nunca se pinta** y las filas de mes no llevan fecha. La última cuota real
es mayo 2033 — coincide con el banco. **La app calcula bien; no enseña el final.**
Eso es el bug de la Fase 2 (cabecera del último año parcial).

---

## Fase 0 · Red de seguridad

Orden invertido respecto a un refactor normal a propósito: primero existe la red
de seguridad, después se toca lo que hoy está sin cubrir.

### 0.1 · `vite.config.js`: acotar el descubrimiento de tests

Hoy `npm test` (sin argumentos) también descubre los tests internos de
`.agents/skills/hallmark/scripts/` y 5 fallan por su entorno. Añadir:

```js
test: { globals: true, environment: 'jsdom', include: ['test/**/*.{js,jsx}'] }
```

Así `npm test` y `npm test -- test/` significan lo mismo y AGENTS.md deja de
advertir del tema.

### 0.2 · Tests unitarios de `state.js`

Hoy **no hay ni un test que importe `state.js`**: parsers, validación y ramas del
reducer solo se ejercitan de forma indirecta desde `App.test.jsx`. Bugs como el
del campo oculto o el de los espacios viven justo en esa zona ciega.

Cubrir con tests que **fijan el comportamiento actual** (caracterización):

- `parseIntField` / `parseFloatField` / `isValidField` por tipo de regla
  (`int`, `number`), con límites min/max.
- `isValidEuriborValue`: rangos, paso de 0,1, epsilon, entradas vacías.
- `hasInvalidFields`: con campos inválidos, con importes de amortización
  inválidos, con borradores Euríbor (solo en tipo variable y dentro del plazo).
- `formatWarning`: los dos tipos de aviso y el caso desconocido.
- Ramas del reducer: `field/changed` (incluida la caché `termYears`/`startYear`),
  `euribor/*`, `amortization/*`, `calculated` (campos inválidos → `calcWarning`),
  `scenario/loaded` con campos de tipos equivocados y `startDate` inválido.

### 0.3 · Caracterización de `simulation.js`: tipo variable y periodo inicial

Es el **caso de uso principal** de la app y hoy no está cubierto. Fijar como
correctos:

- Revisión anual en los múltiplos de 12 → fila `header`, nuevo tipo de interés
  `spread + euríbor`, re-annuitización con los meses restantes.
- Periodo inicial: fila `period-end` en `month == fixedMonths`, interés
  `initialFixedInterest` hasta entonces.
- Amortización tipo `payment` → recálculo de cuota; tipo `plazo` →
  `solveMonths` (ya cubierto parcialmente por el bug #6).
- Significado de `initialPayment` → fija como correcta la **cuota original**
  (decisión 2 de más abajo); el test previo debe capturar el comportamiento
  actual para que el cambio de Fase 2.3 sea deliberado.
- Consistencia: `totalInterest == Σ intereses de las filas`.

> `src/lib/simulation.js` **no se toca en esta fase**.

---

## Fase 1 · Bugs de validación (`state.js`)

### 1.1 · Campo inválido oculto bloquea CALCULAR *(verificado)*

`hasInvalidFields` (`state.js:230`) valida **todos** los campos de `state.invalid`,
incluidos los que no se renderizan para el `type` actual. Reproducido: basura en
"Interés fijo" → cambiar a tipo variable → CALCULAR bloqueado con el aviso
genérico y **ningún campo en rojo** (el input ni siquiera está montado;
`MortgageForm.jsx:103-116`).

Asimetría con los borradores Euríbor (`state.js:232`), que sí se gatean por tipo:
ahí está la intención.

**Fix:** al cambiar de `type`, descartar los `invalid` de los campos que dejan de
renderizarse (mismo patrón que ya usa `field/changed` para los borradores en
`state.js:267`). Alternativa, si se prefiere más explícita: gatear
`hasInvalidFields` por `type`.

**Test:** escribir en "Interés fijo", cambiar a variable → calcula sin aviso; y
el caso inverso (Euríbor/periodo con basura → fijo → calcula).

### 1.2 · `initialPeriodMonths` sin máximo

`FIELD_RULES.initialPeriodMonths` (`state.js:60`) solo tiene `min: 0`. Un valor
≥ `years × 12` (120 meses sobre una hipoteca de 10 años) hace que la condición
`month == fixedMonths` no se alcance nunca → **cero filas `header` en toda la
hipoteca**, el interés se queda en `initialFixedInterest` para siempre y los
overrides del Euríbor del usuario **nunca se aplican, sin ningún aviso**.

**Fix:** máximo dinámico `termYears * 12` (además del `min: 0`).
✅ **Decisión (2026-11-22): (a) marcar el campo en rojo y bloquear el cálculo**,
consistente con el resto de campos inválidos. Si el escenario trae un valor
mayor, queda marcado y el usuario lo ve en rojo antes de calcular.

**Test:** periodo ≥ plazo → campo inválido, CALCULAR bloqueado y aviso; el caso
de `create-own-amortizations` (60 meses sobre 15 años) sigue calculando igual.

### 1.3 · Espacios en blanco validan como 0 *(verificado)*

`parseFloatField` (`state.js:69`) solo descarta `''`: `Number('   ') === 0`, así
que un campo con solo espacios es **válido** y llega al cálculo como 0 % de
interés.

**Fix:** `trim()` antes de validar (en `parseFloatField` y en el test del patrón
`^\d+$` de `parseIntField`, que ya cubre espacios por `[.,\s]` pero conviene
dejarlo explícito).

**Test:** `"   "` → `NaN` → campo inválido.

### 1.4 · `1.5` en Capital se interpreta como 15 — ✅ decidido: **(a) solo enteros**

`parseIntField` (`state.js:64`) elimina `[.,\s]` (semántica heredada de
separadores de miles del `check()` antiguo): `parseIntField('1.5') === 15` y
`parseIntField('1,5') === 15`. En Capital, escribir `1.5` valida como **15 €**.

**Decisión del propietario (2026-11-22): las cantidades siempre deben ser
enteros, nunca decimales.** → **(a)**: exigir dígitos limpios y marcar el campo
en rojo si contiene `.` o `,` o espacios. Un capital mal interpretado es el error
más caro de la aplicacion.

**Alcance:** `parseIntField` se usa para Capital, Plazo, Inicio, Periodo inicial
e importes de amortización — todos enteros por naturaleza, así que la regla
vale para los seis. `parseFloatField` (intereses) sí sigue aceptando decimales.

**Tests:** `'1.5'` → `NaN`; `'1,5'` → `NaN`; `'1 500'` → `NaN`; `'1500'` → `1500`.
Los escenarios existentes usan enteros limpios (`150000`, `71000`), así que no
rompen.

---

## Fase 2 · Bugs de cálculo (`simulation.js`, tests primero)

### 2.1 · Cabecera con año fraccionario

`const loanYear = Math.abs(month / 12)` (`simulation.js:143`): `Math.abs` es
inútil y no redondea. Con un periodo inicial que no es múltiplo de 12 (p. ej. 18
meses) la cabecera muestra **"Año 2027.5, … año 1.5 del préstamo"**.

**Fix:** `Math.floor(month / 12)`.

**Test:** `initialPeriodMonths: 18` → todas las cabeceras con `loanYear` entero.

### 2.2 · Falta la cabecera del último año parcial

Causa del "termina en 2032" descrita arriba: el último `header` que se pinta es
el del mes 108 y las filas de mes no llevan fecha, así que el año final del
préstamo es invisible.

**Decisión del propietario (2026-11-22): (a) solo la fila de cierre.** Añadir
una fila de evento al terminar el bucle — p. ej. `kind: 'end'` → *"Fin del
préstamo"* — que deja explícito el último año. Sin año en cada fila de mes.

**Test:** el resultado contiene la fila de cierre; con el escenario de
`create-own-amortizations` se ve que termina en 2033.

### 2.3 · Semántica de `initialPayment` — ✅ decidido: **(a) cuota original**

`initialPayment` se captura en el mes 0 (`simulation.js:210`), **después** de
aplicar las amortizaciones de ese mes. Con una amortización tipo `payment` en el
mes 1 muestra la cuota ya recalculada; con tipo `plazo` la cuota no cambia, así
que muestra la original. Semántica inconsistente entre tipos.

**Decisión del propietario (2026-11-22): mostrar la cuota original, la que
ofrece el banco.** → capturar la anualidad **antes** de las amortizaciones del
mes 0: "Tu cuota inicial" = la cuota de la oferta.

**Test:** con una amortización tipo `payment` en año 1 mes 1, `initialPayment`
igual a la anualidad del capital/plazo/tipo iniciales (y distinto de la cuota
recalculada del mes 1).

### 2.4 · Robustez de la lib

`type: 'variable'` con `euribor` vacío → `interest = spread + undefined` →
**NaN en toda la tabla**. Inalcanzable desde la UI (el estado siempre pone
`euribor[0]`), pero la lib se presenta como pura y autónoma.

**Fix:** valor por defecto del euríbor si no hay ninguno (o guard que trate el
tipo variable sin serie como fijo con aviso). Decisión menor, cubierta por test.

---

## Fase 3 · Tests nuevos

### 3.1 · Simulación: casos límite

- Capital 0 → fila `initial`, `initialPayment: null`, sin crash (ya verificado
  manualmente, falta el test).
- Plazo de 1 año → una sola revisión anual.
- `totalInterest == Σ intereses` de las filas `month`.
- Amortización tipo `payment` recalcula cuota (el test del bug #2 solo mira
  saldos).
- Cobertura de 2.1, 2.2, 2.3, 2.4.

### 3.2 · UI (`App.test.jsx`)

- Teclado en "Calcular" (Enter y Space) — ligado a la Fase 4.
- Botón "Eliminar" de una amortización → se borra la fila correcta.
- Importe de amortización inválido → bloquea el cálculo.
- Campo "Inicio" → etiquetas de año de la cabecera de la tabla.
- Escenario con `startDate` inválido o campos de tipo equivocado → no rompe.
- Los tests de regresión de la Fase 1 (campo oculto, espacios, periodo inicial).

---

## Fase 4 · Accesibilidad y rendimiento

### 4.1 · "Calcular" como `<button>` real

Hoy es un `<a role="button" tabIndex={0}>` con soporte de teclado escrito a mano
(`App.jsx:66-83`): `onKeyDownCapture` para Space, Enter, `onKeyUp`… Funciona
(finish-review del rediseño lo arregló), pero un `<button>` obtiene Enter/Space,
foco y deshabilitado gratis y permitiría `aria-disabled` **antes** del clic:
hoy el error solo aparece después de pulsar.

**Fix:** `<button type="button">`, mover el dispatch a `onClick`, usar
`aria-disabled` + `disabled` (o `aria-disabled` con manejo explícito para
conservar el foco) cuando `hasInvalidFields` sea cierto. Conservar el estilo
Almanac actual y el test de teclado.

### 4.2 · Nombres accesibles de "Eliminar"

Todos los botones de borrar se llaman igual (`Amortizations.jsx`): un lector de
pantalla no sabe qué fila elimina.

**Fix:** `aria-label={`Eliminar amortización año ${year} mes ${month}`}`.

### 4.3 · `aria-describedby`

Los campos con error ponen `aria-invalid` pero no enlazan el mensaje
(`MortgageForm.jsx:10-16`). Añadir `aria-describedby` al `<span>` de error
cuando exista (patrón ya bien hecho en `EuriborEvolution.jsx:50`).

### 4.4 · Memoización

No hay ni un `React.memo`/`useMemo`/`useCallback` en la app: cualquier cambio de
estado reconstruye la tabla (hasta 600+ `<tr>`) y el bloque Euríbor (101
inputs). `euribor/toggled` es el caso que mantiene el resultado y reconstruye
todo.

**Fix:** `React.memo` en `ResultsTable`, `useMemo` para las filas derivadas de
`result`, y evitar que el panel plegado del Euríbor reconstruya 101 inputs
renderizados con `display: none`. Medir antes y después con la tabla de 50 años.

### 4.5 · Unificar la presentación de error

`is-invalid` + `aria-invalid` + `style={{backgroundColor: 'var(--color-error-surface)'}}`
está triplicado (`MortgageForm.jsx:14-15`, `Amortizations.jsx:63-68`).

**Fix:** helper compartido (p. ej. `inputErrorProps(name)` exportado desde un
módulo común) usado por ambos componentes.

---

## Fase 5 · Limpieza y documentación

### 5.1 · CSS muerto

- Estados que el JSX nunca emite: `.calculate-action[aria-disabled]`,
  `[aria-busy]`, `.is-success`, `.text-action[aria-invalid]`
  (`style.css:334-354, 494-500`). **Ojo:** la Fase 4.1 *sí* va a emitir
  `aria-disabled` — revisar este bloque después de la Fase 4, no antes.
- Utilidades sin usar de `base.css`: `.lead`, `.container`, `.figure`,
  `[data-slot]`.
- Bloque duplicado `.calculate-action-wrapper` dentro del mismo media query
  (`style.css:658` y `681`).

Ver con `sloplint` que no se rompe nada tras limpiar.

### 5.2 · Documentación desactualizada

- **`AGENTS.md:25,27`** — nombres de componentes viejos en español
  (`FormularioDatos`, `Amortizaciones`, `EuriborEvolucion`, `ResultadoTabla`);
  los archivos reales son `MortgageForm.jsx`, `Amortizations.jsx`,
  `EuriborEvolution.jsx`, `ResultsTable.jsx` (renombrados en `0fb7a48`).
- **`AGENTS.md:11`** — "the 16 tests" → 18 (y crecerá).
- **`AGENTS.md`** — documentar `test.include` y que `npm test` ya no necesita
  argumentos (tras la Fase 0.1).
- **`src/lib/simulation.js:8-9`** — "Loaded as a classic script from
  `index.html`" es falso desde la reescritura React: se importa como ESM.
- **`src/state.js:16`** — "50 = max term" pero `EURIBOR_SERIES` tiene **51**
  entradas. Ajustar comentario o longitud (sin efecto: la 51ª no se usa).
- **`src/state.js:1-11`** — el encabezado dice que `simulation.js` "must not
  change"; con la aprobación del propietario hay que matizarlo.

### 5.3 · Higiene del repo

- `.idea/` (7 ficheros) está **trackeado** en git; añadir `/.idea/` a
  `.gitignore` y quitarlo del índice (`git rm -r --cached .idea`). La rama
  `create-own-amortizations` ya lleva esa regla.
- Exports de `state.js` que no importa nadie: `SCENARIO_WARNING`,
  `INVALID_FIELDS_WARNING`, `parseIntField`, `parseFloatField`, `isValidField`,
  `isValidAmortizationAmount`, `hasInvalidFields`. **Decisión:** o se usan en
  los nuevos tests de la Fase 0.2 (lo más probable — entonces se quedan), o se
  dejan de exportar.
- `README.md` es un solo título: descripción, `npm install`, `npm run dev`,
  `npm test`, `npm run build`, nota del `escenario.json` por rama.
- `DEFAULT_AMORTIZATION` se declara después de su primer uso
  (`state.js:196` vs 175/313) — moverlo arriba por legibilidad.

### 5.4 · Poner al día los planes

- `plan/redesign.md` Fase 4 → ✅ (el merge a master `41ece5e` ya ocurrió).
- `plan/redesign-personal-branches.md:89-95` → marcar casillas: ambas ramas ya
  contienen el rediseño, están 0 commits detrás de master y sus previews se
  subieron (`865f17f`, `486869e`).

---

## Decisiones — ✅ todas resueltas (2026-11-22)

1. **`1.5` en Capital** → **(a) solo enteros**: exigir dígitos limpios, marcar en
   rojo cualquier `.`/`,`/espacio. Aplica a los seis campos enteros (Capital,
   Plazo, Inicio, Periodo inicial, importes de amortización); los intereses
   siguen aceptando decimales.
2. **`initialPayment`** → **(a) cuota original del banco**: capturar la anualidad
   antes de las amortizaciones del mes 0.
3. **Periodo inicial ≥ plazo** → **(a) marcar en rojo y bloquear el cálculo**.
4. **Cierre de la tabla** → **(a) solo la fila "Fin del préstamo"**, sin año en
   cada fila de mes.

## Lo que NO se toca

- **El orden amortización → intereses**: decisión del propietario, demostrado
  arriba que no cambia el resultado (2033 en ambos órdenes).
- **Los datos de `public/escenario.json` de las ramas personales.**
- **El sistema de diseño Almanac** (salvo limpieza de 5.1 y los estilos
  necesarios de la Fase 4).
- **`vercel.json` y `vite.config.js`** salvo el `test.include` de la Fase 0.1.

---

## Puerta de verificación

Como siempre en este repo (no hay CI; cada push despliega):

1. `npm test` → suite completa en verde (tras la Fase 0.1 funciona sin
   argumentos).
2. `npm run build` → OK, `dist/` con `escenario.json`.
3. `node .agents/skills/hallmark/scripts/sloplint.mjs src/ --render --url http://localhost:5173/`
   → sin FAIL nuevos (requiere dev server + Chrome; sin Chrome solo el tier
   estático, y nunca claim de un render que no corrió).
4. Revisión manual en navegador: carga el escenario, calcula, la tabla muestra
   el cierre en 2033 en el escenario de `create-own-amortizations`, y los campos
   inválidos ocultos ya no bloquean.
5. Push → **comprobar el deploy en Vercel** → PR.

---

## Comandos

```bash
npm test            # tras Fase 0.1: sin argumentos, solo tests del simulador
npm run build       # errores de import/JSX + dist/
npm run dev         # para sloplint --render en paralelo
```
