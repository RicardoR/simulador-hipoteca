# Mejoras de la tabla: mes de inicio, nombres de mes y centrado

Plan acordado el 2026-11-24 con el propietario. Tres mejoras de presentación
surgidas al revisar la tabla en `create-own-amortizations`: las filas de
amortización van pegadas a la izquierda, el mes de inicio se tira (solo se
guarda el año de `startDate`) y los meses de la tabla son números sin nombre.

Rama de trabajo: **`table-months`** (desde master `9434ea0`, limpio).

> **Frontera estable:** `src/lib/simulation.js` recibe solo cambios aditivos de
> presentación (las filas de amortización/revisión llevan su índice de mes),
> con tests primero. El cálculo no cambia: la revisión del tipo sigue el
> aniversario del préstamo; el rótulo del año calendario se pinta en enero.

## Progreso

| Fase | Tarea | Estado |
|---|---|---|
| **1 · Mes de inicio** | `startMonth` en estado + select de mes en "Inicio" + siembra desde `startDate` | ✅ Hecho |
| **2 · Nombres de mes** | Helper de calendario + columna Mes con nombre + cierre y amortizaciones con fecha | ✅ Hecho |
| **3 · Centrado** | `text-align: center` solo en las filas de amortización | ✅ Hecho (sloplint render: 0 FAIL) |
| **4 · Docs** | `AGENTS.md` (`startMonth`, módulo `loanCalendar`) | ✅ Hecho |
| **5 · Revisión visual** | Meses a 3 letras (todos ocupan lo mismo) y el input del año sin encogerse en `.field-control` | ✅ Hecho |
| **6 · Año calendario vs revisión** | Rótulo de año en enero; revisión de cuota en el aniversario, ambos eventos independientes | ✅ Hecho |

**Leyenda:** ⬜ Pendiente · 🔵 En curso · ✅ Hecho

## Decisiones — resueltas (2026-11-24)

1. **Centrado** → solo las filas de amortización (`--amortization`), no todas
   las filas de evento.
2. **Mes de inicio** → campo de formulario editable como el año: select de mes
   junto al input de año en "Inicio"; se guarda en el estado y se siembra desde
   `escenario.json.startDate` (mismo camino que `startYear` en las ramas
   personales). `startDate` inválida o ausente → se conserva el valor; por
   defecto, mes y año actuales.
3. **Nombres de mes** → número + abreviatura de 3 letras ("1 · Jun 2023"):
   el número se queda porque dice cuántas cuotas se pagan; los meses van
   abreviados para que todos ocupen lo mismo (revisado en la revisión visual
   de 2026-11-24: se acordó nombre completo y se cambió a 3 letras al verlo).
   También en la fila de cierre ("May 2033 · mes 120") y en las filas de
   amortización.
4. **Cabeceras de año** → sin rango de meses ("jun 2024 – may 2025"): la
   cabecera ya es larga.
5. **Año calendario y revisión anual** → son eventos diferentes: el rótulo
   "Año 2027" aparece al empezar enero; la cuota se revisa en el aniversario
   del préstamo (por ejemplo, septiembre si empezó en septiembre). No cambiar
   la fecha ni el orden del cálculo bancario.

## Fase 1 · `startMonth`

- `FIELD_RULES.startMonth` (`int, min 1, max 12`) y `DEFAULT_FIELDS.startMonth`
  = mes actual (mismo espíritu que el año por defecto).
- `applyScenario`: `startDate` válida → `setField('startMonth', getMonth()+1)`;
  inválida o ausente → se conserva. Sin efecto en `buildSimulationInput`:
  el mes de inicio es presentación, no entra en el cálculo.
- Formulario: `Inicio: [Jun ▾] [2023]` — select con `MONTH_NAMES`, siempre
  válido (sin estados rojos nuevos), igual que el select de Tipo.

## Fase 2 · Nombres de mes en la tabla

- `src/lib/loanCalendar.js`: `MONTH_NAMES` +
  `loanCalendarMonth(loanMonth, startMonth, startYear) -> { monthIndex, year }`.
- `ResultsTable` recibe `startMonth`; columna Mes → `1 · Jun 2023`; fila de
  cierre → `Fin del préstamo (May 2033 · mes 120)` — año exacto de calendario,
  sin la aproximación por bloques `startYear + loanYear`; filas de amortización
  → `… (Jun 2023)`.
- `simulation.js` (aditivo, tests primero): las filas de amortización llevan
  `month` (1-based).

## Fase 3 · Centrado

`.results-table-section tbody .table-event--amortization td { text-align:
center; }` — con la especificidad completa, porque la regla base de
`.table-event td` (alineada a la izquierda) ganaría si no. sloplint después.

## Fase 6 · Etiquetas del año calendario y revisiones

- `simulation.js`: renombrar el evento ambiguo `header` a `review` y etiquetarlo
  con el mes de cuota efectivo (1-based); añadir el mismo índice a
  `period-end`. Caracterizar primero: la revisión anual sigue en los meses 13,
  25, … desde el inicio del préstamo, y tras un periodo inicial en
  `initialPeriodMonths + 1`.
- `ResultsTable`: insertar "Año YYYY" al comenzar cada año calendario (enero),
  usando `loanCalendarMonth`; no derivar los rótulos de las revisiones
  hipotecarias. Renderizar las revisiones como "Revisión anual de cuota:
  Euríbor …" con el mes de aniversario. Si ambos coinciden en enero, mostrar
  los dos hechos explícitamente.
- Regresión UI: préstamo iniciado en septiembre → "Año 2026" antes de la
  primera cuota, "Año 2027" antes de enero (cuota 5), y revisión antes de la
  cuota 13 en septiembre de 2027.

## Lo que NO se toca

- El cálculo (`calculateSimulation`): filas, cuotas, intereses — sin cambios.
- Las etiquetas de año del Euríbor y el calendario financiero de las revisiones.
- Los datos de `escenario.json` de las ramas personales (sus `startDate` ya
  traen el mes: mayo y junio de 2023).

## Puerta de verificación

1. `npm test` → suite en verde.
2. `npm run build` → OK, `dist/` con `escenario.json`.
3. `sloplint --render` → 0 FAIL (dev server + Chrome; sin Chrome, solo el tier
   estático, y nunca claim de un render que no corrió).
4. Navegador: el escenario de `create-own-amortizations` muestra "1 · Jun
   2023" en la primera cuota y "May 2033 · mes 120" en el cierre; las filas
   de amortización centradas.
5. Push → comprobar previews → PR.
