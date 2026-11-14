# Fix issues and refactor

Plan de trabajo para `simulador-hipoteca`: corregir los bugs de cálculo y lógica, extraer los datos personales fuera del código, y reescribir el frontend en React.

Rama de trabajo: **`fix-issues`** (parte de master `6161fe3`, limpia).

---

## Estrategia: dos tramos

| Tramo | Contenido | Rama | Destino |
|---|---|---|---|
| **A** | Fase 0 + 1 + 3 (cálculo, bugs, JSON) | `fix-issues` | PR a **master** |
| **B** | Fase 2 + 4 (React, limpieza) | nueva, cuando A esté mergeado | PR a **master** |

**Por qué en este orden** (no invertir):

Las 4 ramas personales despliegan cada una una web distinta y divergen de master **solo en `index.html` + `src/main.js`** — justo los dos archivos que React reescribirá. Su divergencia es 100% datos, 0% código:

| Rama | Difiere en | Qué cambia |
|---|---|---|
| `create-own-amortizations` | `.gitignore`, `index.html`, `src/main.js` | defaults + 6 amortizaciones |
| `marcos-amortizations` | `index.html`, `src/main.js` | 100k / 20a / 1% + amortizaciones |
| `mikel-amortizations` | `index.html`, `src/main.js` | 50k / 10a / 0.95% + amortizaciones |
| `pelaez-amortizations` | `index.html`, `src/main.js` | 80k / 30a / 4.3% + amortizaciones |

Si React llega a master **antes** de extraer los datos a JSON, cada rama al mergear chocará en los 2 archivos que reescribió React, 4 veces. Extrayendo primero (Fase 3), cada rama queda reducida a `master` + 1 archivo JSON, y el merge de React posterior es sin conflictos de código.

**El orden dentro del Tramo A también importa:** Fase 0 (tests) → Fase 1 (bugs) → Fase 3 (JSON). Los tests tienen que existir antes de tocar los bugs, o no hay con qué comprobar que los números siguen bien.

---

## Tramo A — `fix-issues` → master

### Fase 0 · Separar cálculo de presentación

`getTable` hoy calcula **y** escribe en el DOM (`$('#tableBody').html(...)`, `$('#mortgageContainer').html(...)`). Se parte en:

```js
// src/lib/simulation.js — sin DOM, sin jQuery, sin React
calculateSimulation(input) -> { rows, initialPayment, totalInterest, warnings }

// src/main.js (transitorio, Fase 0-1) — solo vuelca el resultado al DOM
```

```js
input = {
  capital, years, type: 'fixed' | 'variable',
  fixedInterest, euriborSpread, initialFixedInterest,
  initialPeriodMonths, initialPeriodActive,
  euribor,                                  // array indexado por mes
  amortizations: [{ year, month, amount, type: 'term' | 'payment' }]
}
```

Con **Vitest**.

**Tests de caracterización**: fijar como correctos los casos que hoy cuadran, para que cualquier cambio posterior en los números sea deliberado:

- `100k / 15a / 2.25%` → cuota `655.08`, saldo final `0.000000`
- `100k / 15a / fijo 0.01%` → cuota `555.97`, intereses `75.44`

> **`src/lib/simulation.js` no se toca en las Fases 2-4.** Es la frontera estable entre el código jQuery y el React, y la que tiene tests.

---

### Fase 1 · Los 7 bugs

Todos verificados ejecutando el código real de `getTable` con un DOM simulado, no por lectura.

| # | Bug | Fix | Test que lo demuestra |
|---|---|---|---|
| **1** | Interés 0% → **NaN en toda la tabla**. Alcanzable desde la UI: input de tipo fijo `min:0`, slider euríbor hasta `-0.5` con spread `min:0` | guard en la anualidad: `if (i === 0) return P / n` | `calculateSimulation(0%)` → cuota `555.56`, no NaN |
| **2** | Dos amortizaciones en el mismo mes → **la 2ª borra a la 1ª**. `amortizationUserData[(año-1)*12 + mes-1]` es un array disperso | lista de amortizaciones, no array indexado por mes | `1000+2000` mismo mes ≠ `2000` |
| **3** | Slider euríbor **muestra 5.00 y calcula 2.30**. `buildEuriborEvolutionSection` renderiza el valor del usuario (línea 52-54) y acto seguido lo sobrescribe con la serie por defecto (línea 65) | borrar el reinicio incondicional; en React el estado es la única fuente | tras rebuild, valor visible == valor calculado |
| **4** | Amortización > saldo → **cuota e intereses negativos** (sin validación). `Cuota 150000` sobre `100000` → cuota `-327.54`, intereses `-93.75`, saldo `-49766` | `cantidad >= saldo` → saldo a 0, terminar, emitir aviso | `Cuota 150000` → saldo 0 + aviso |
| **5** | Última fila con **saldo negativo**: el `break` ocurre *después* del append | cuota final clamped: `capital = min(capital, saldo)` | última fila siempre `>= 0` |
| **6** | Reducción de "Plazo": `months -= Math.floor(c/cuota)` **ignora intereses** y hace doble trabajo junto a `pendingAmount -= c`. Desvío medido: código **173 meses / 20100€** vs referencia de banco **176 meses / 20447€** | tras `saldo -= c`: `mesesRestantes = solveN(saldo, cuota, tasa)` (cerrado: `n = -ln(1 - saldo·i/cuota) / ln(1+i)`) | cuota intacta, plazo derivado de la igualdad |
| **7** | Amortización **fuera del plazo se ignora en silencio** (año 20 con plazo de 15 → resultado idéntico a no tener, sin aviso) | avisos en `warnings[]` + el select de año se recalcula con el plazo actual | año 20 con plazo 15 → aviso visible |

**Los fixes 4, 5 y 6 comparten refactorización** — no se arreglan por separado.

#### Modelo de cálculo resultante

Sustituye al bucle actual, que muta `months` como variable de control de bucle:

```
cada mes:
  revisión anual → cuota = anualidad(saldo, mesesRestantes, tasa)
  amortización   → Cuota: saldo -= c; cuota = anualidad(saldo, mesesRestantes, tasa)
                   Plazo:  saldo -= c; mesesRestantes = solveN(saldo, cuota, tasa)
  intereses   = saldo · tasa/12/100
  capital     = min(cuota - intereses, saldo)
  saldo      -= capital
  mesesRestantes--
  parar si saldo == 0 o mesesRestantes == 0
```

**Puerta de verificación del Tramo A:** `npm test` en verde, y la tabla del navegador coincide con los tests de caracterización.

---

### Fase 3 · Extraer datos a JSON

*Va en el Tramo A a propósito: es lo que reduce la divergencia de cada rama de 2 archivos de código a 1 archivo de datos.*

`escenario.json` — contiene **defaults del formulario Y amortizaciones**, porque las ramas divergen en ambos:

```json
{
  "capital": 100000,
  "years": 20,
  "type": "variable",
  "euriborSpread": 1,
  "initialFixedInterest": 2.25,
  "fixedInterest": 2.25,
  "initialPeriodMonths": 60,
  "initialPeriodActive": true,
  "amortizations": [
    { "year": 1, "month": 1, "amount": 4000, "type": "payment" }
  ]
}
```

- **Ubicación: raíz del repo** (`/escenario.json`), no `public/`. En el Tramo A no hay build, así que `public/` se serviría como `/public/escenario.json` y la URL sería distinta. En la Fase 2 se mueve a `public/escenario.json`, que Vite sirve en la raíz de `dist/` → **misma URL, `/escenario.json`**.
- **Se edita sin recompilar.** Es el punto de la Fase 3.
- `fetch` con ruta relativa (`escenario.json`, sin barra inicial).
- Fallback a valores por defecto + aviso si falla.
- Cada rama personal reemplaza este archivo por el suyo.

---

## Tramo B — nueva rama → master

Se crea cuando el Tramo A esté mergeado. Nombre propuesto: `react-rewrite`.

### Fase 2 · React

- **Vite + React** (nuevo `package.json`; no existe hoy). `npm run dev`, `npm run build`, `npm test`.
- `src/lib/simulation.js` **no se toca**: ya tiene sus tests.
- Componentes: `FormularioDatos`, `Amortizaciones`, `EuriborEvolucion`, `ResultadoTabla`.
- Un solo estado (`useReducer`) para todo. **Esto elimina de raíz los bugs 2 y 3**: hoy el estado vive duplicado entre variables del closure y el DOM, y las dos fuentes divergen.
- **Mover `escenario.json` de la raíz a `public/`** (ver §Despliegue en Vercel): la URL `/escenario.json` no cambia, pero sin este paso Vite no lo incluiría en `dist/` y el `fetch` fallaría en producción.
- **Ajustar Vercel:** Build Command `npm run build`, Output Directory `dist`, Install Command `npm install`. Sin esto el deploy sigue sirviendo la raíz y la web queda rota.

**Desaparecen:**

- `index.html` con sus 6 handlers inline (`onkeyup="mainFunction.check(...)"`)
- el override global de `parseInt`
- el acoplamiento `check → max == 50` que reconstruye la sección de euríbor
- el polling de `setInterval` esperando a jQuery
- `src/jquery.min.js`

### Fase 4 · Limpieza

- `getAmortizationsData()` (los 6 amortizamientos demo)
- override global de `parseInt`
- `START_DATE` hardcodeado → pasa a campo del formulario (hoy fija las etiquetas de año en `12 may 2023`)
- restos de `mainFunction`

**Puerta de verificación del Tramo B:** `npm test` → `npm run build` → revisar `dist/` generado (que contenga `escenario.json`) → push → **comprobar el deploy en Vercel**, no solo el local.

---

## Ramas personales — se mantienen

Cada rama (`create-own-amortizations`, `marcos-`, `mikel-`, `pelaez-amortizations`) recibe, en este orden:

1. **merge de master con el Tramo A** → llegan los 7 bugs arreglados *(están desplegadas, es lo urgente)*
2. **convierten sus datos al JSON** → 1 archivo, tarea de pocos minutos
3. **merge del Tramo B** cuando React esté en master → sin conflictos de código, solo conviven con su JSON

### Descartadas

- **`remove-jquery`** → al ~12% (4 de 32 llamadas convertidas) y un commit por detrás de master. React la vuelve obsoleta; fusionar solo genera conflictos.
- **`add-agents`** → ya mergeado en master (contiene `AGENTS.md`).

---

## Resumen de comandos

```bash
npm test          # tests de caracterización + regresión de bugs
npm run build     # errores de import/JSX
# + comprobación manual en navegador contra los tests
```

No hay lint ni typecheck configurados hoy; si se añaden en la Fase 2, el orden pasa a ser `lint -> typecheck -> test`.

---

## Despliegue en Vercel

Cada rama despliega su propia web en Vercel **al hacer push**. La configuración vive en el dashboard: **no hay `vercel.json` ni `package.json` en ninguna rama**, así que hoy Vercel sirve los archivos estáticos de la raíz sin build.

**Implicaciones para este plan:**

1. **Cada push a cualquier rama es un deploy en vivo.** Durante el Tramo A/B, `fix-issues` estará pública desde el primer push — no empujar estado intermedio roto si esa web se comparte. Las ramas personales también despliegan: un merge mal resuelto ahí rompe su web real.

2. **Al añadir `package.json` (Fase 2) hay que ajustar el dashboard de Vercel.** Sin build command ni output directory, Vercel no sabrá ejecutar `npm run build` ni servir `dist/`. Configuración necesaria en Vercel → Project → Settings → Build & Development:
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`

   Si no se cambia, el deploy seguirá sirviendo la raíz y la web quedará rota o servirá el `index.html` antiguo.

3. **Ruta del JSON — cuidado con el cambio entre tramos.** En el Tramo A (sin build) un archivo en `public/` se sirve como `/public/escenario.json`; con Vite en el Tramo B, `public/` se copia a la raíz de `dist/` y pasa a servirse como `/escenario.json`. Para que la URL no cambie entre tramos:
   - **Tramo A:** `escenario.json` en la **raíz del repo** → `/escenario.json`
   - **Tramo B (Fase 2):** moverlo a `public/escenario.json` → sigue siendo `/escenario.json`
   - El `fetch` usa ruta relativa (`escenario.json`, sin barra inicial) para que aguante también si algún día se sirve bajo subpath.

4. **No hay CI** (sin `.github/workflows`): la única red de seguridad son los tests locales antes de pushear. El orden `npm test` → `npm run build` → push no es opcional, es lo único que evita romper una web en vivo.

## Decisiones abiertas

1. **Vite o CDN** — recomendado Vite, porque Vitest encaja de serie.
2. **¿La amortización se aplica antes o después de los intereses de ese mes?** Hoy es *antes* → ahorro ligeramente optimista. **No se toca**: cambiarlo altera todos los números y es decisión del propietario, no un bug claro.
