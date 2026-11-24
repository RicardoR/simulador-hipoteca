# Mejoras de la tabla: mes de inicio, nombres de mes y centrado

Plan acordado el 2026-11-24 con el propietario. Tres mejoras de presentación
surgidas al revisar la tabla en `create-own-amortizations`: las filas de
amortización van pegadas a la izquierda, el mes de inicio se tira (solo se
guarda el año de `startDate`) y los meses de la tabla son números sin nombre.

Rama de trabajo: **`table-months`** (desde master `9434ea0`, limpio).

> **Frontera estable:** `src/lib/simulation.js` solo recibe un cambio aditivo
> (las filas de amortización pasan a llevar su índice de mes, necesario para
> fecharlas), con tests primero. El cálculo no cambia.

## Progreso

| Fase | Tarea | Estado |
|---|---|---|
| **1 · Mes de inicio** | `startMonth` en estado + select de mes en "Inicio" + siembra desde `startDate` | ✅ Hecho |
| **2 · Nombres de mes** | Helper de calendario + columna Mes con nombre + cierre y amortizaciones con fecha | ✅ Hecho |
| **3 · Centrado** | `text-align: center` solo en las filas de amortización | ✅ Hecho (sloplint render: 0 FAIL) |
| **4 · Docs** | `AGENTS.md` (`startMonth`, módulo `loanCalendar`) | ✅ Hecho |
| **5 · Revisión visual** | Meses a 3 letras (todos ocupan lo mismo) y el input del año sin encogerse en `.field-control` | ✅ Hecho |

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

## Fase 1 · `startMonth`

- `FIELD_RULES.startMonth` (`int, min 1, max 12`) y `DEFAULT_FIELDS.startMonth`
  = mes actual (mismo espíritu que el año por defecto).
- `applyScenario`: `startDate` válida → `setField('startMonth', getMonth()+1)`;
  inválida o ausente → se conserva. Sin efecto en `buildSimulationInput`:
  el mes de inicio es presentación, no entra en el cálculo.
- Formulario: `Inicio: [Junio ▾] [2023]` — select con `MONTH_NAMES`, siempre
  válido (sin estados rojos nuevos), igual que el select de Tipo.

## Fase 2 · Nombres de mes en la tabla

- `src/lib/loanCalendar.js`: `MONTH_NAMES` +
  `loanCalendarMonth(loanMonth, startMonth, startYear) -> { monthIndex, year }`.
- `ResultsTable` recibe `startMonth`; columna Mes → `1 · Junio 2023`; fila de
  cierre → `Fin del préstamo (Mayo 2033 · mes 120)` — año exacto de calendario,
  sin la aproximación por bloques `startYear + loanYear`; filas de amortización
  → `… (Junio 2023)`.
- `simulation.js` (aditivo, tests primero): las filas de amortización llevan
  `month` (1-based).

## Fase 3 · Centrado

`.results-table-section tbody .table-event--amortization td { text-align:
center; }` — con la especificidad completa, porque la regla base de
`.table-event td` (alineada a la izquierda) ganaría si no. sloplint después.

## Lo que NO se toca

- El cálculo (`calculateSimulation`): filas, cuotas, intereses — sin cambios.
- Las etiquetas de año del Euríbor y las cabeceras de año de la tabla.
- Los datos de `escenario.json` de las ramas personales (sus `startDate` ya
  traen el mes: mayo y junio de 2023).

## Puerta de verificación

1. `npm test` → suite en verde.
2. `npm run build` → OK, `dist/` con `escenario.json`.
3. `sloplint --render` → 0 FAIL (dev server + Chrome; sin Chrome, solo el tier
   estático, y nunca claim de un render que no corrió).
4. Navegador: el escenario de `create-own-amortizations` muestra "1 · Junio
   2023" en la primera cuota y "Mayo 2033 · mes 120" en el cierre; las filas
   de amortización centradas.
5. Push → comprobar previews → PR.
