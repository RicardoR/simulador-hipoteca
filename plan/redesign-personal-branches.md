# Llevar el rediseño a las ramas personales

## Objetivo

Incorporar el rediseño ya mergeado en `master` a `pelaez-amortizations` y
`create-own-amortizations`, manteniendo en cada rama su escenario de hipoteca y
sus personalizaciones existentes. Seguir el flujo usado para propagar la
reescritura a React: integrar `master` **hacia** cada rama, no al revés.

## Punto de partida

- `master`: `41ece5e` — merge de la PR del rediseño.
- `pelaez-amortizations`: `b9559c2`.
- `create-own-amortizations`: `1f61229`.
- Las dos ramas ya contienen la reescritura React y sus escenarios viven en
  `public/escenario.json`.
- El árbol local de `master` estaba limpio antes de añadir este plan.

### Datos que deben conservarse

No copiar el escenario por defecto de `master` sobre ninguna rama.

- **`pelaez-amortizations`**: `startDate: 2023-05-12`, capital `80000`, plazo
  `30`, Euríbor + `1`, periodo inicial fijo activo al `4.3%` durante `120`
  meses, y una amortización de `100` en año 1, mes 1, tipo `payment`.
- **`create-own-amortizations`**: `startDate: 2023-06-01`, capital `71000`,
  plazo `15`, Euríbor + `1`, periodo inicial fijo activo al `2.25%` durante
  `60` meses, y las seis amortizaciones actuales:
  `4000/payment` (año 1, mes 1), `6000/term` (año 1, mes 2),
  `5000/term` (año 1, mes 3), `4000/term` (año 1, mes 5),
  `500/term` (año 2, mes 4) y `5000/term` (año 3, mes 8).

También conservar las personalizaciones no relacionadas con el rediseño:

- `pelaez-amortizations`: título y descripción personalizados de `src/App.jsx`
  y título de `index.html`.
- `create-own-amortizations`: regla `/.idea/` en `.gitignore`.

## Plan de trabajo

### 1. Integrar `master` en `pelaez-amortizations`

1. Confirmar que la rama está limpia y actualizada con
   `origin/pelaez-amortizations`.
2. Fusionar `master` en la rama, siguiendo el patrón histórico de merge.
3. Si `src/App.jsx` entra en conflicto, conservar la estructura, los componentes
   y el cableado actuales de `master`; reincorporar el título y la descripción
   personalizados de Roberto en esa estructura.
4. Conservar el título personalizado de `index.html`.
5. Confirmar que `public/escenario.json` mantiene exactamente los datos listados
   arriba. Resolver cualquier conflicto favoreciendo el escenario de esta rama,
   no los valores por defecto de `master`.
6. Ejecutar las verificaciones comunes y revisar la aplicación con este
   escenario.

### 2. Integrar `master` en `create-own-amortizations`

1. Confirmar que la rama está limpia y actualizada con
   `origin/create-own-amortizations`.
2. Fusionar `master` en la rama.
3. Mantener la regla `/.idea/` de `.gitignore`.
4. Confirmar que `public/escenario.json` conserva el escenario y las seis
   amortizaciones listadas arriba. No reemplazarlo con el escenario de `master`.
5. Ejecutar las verificaciones comunes y revisar la aplicación con este
   escenario.

### 3. Verificación común, en cada rama

1. `npm test -- test/` — pruebas de simulación y UI en verde.
2. `npm run build` — build correcto y `dist/escenario.json` presente.
3. Revisión en navegador del deploy/preview de esa rama:
   - carga el `escenario.json` de la rama;
   - muestra los campos, periodo inicial y amortizaciones esperados;
   - calcula y muestra el cuadro de amortización;
   - el título/copy personalizado de Pelaez sigue presente.
4. Revisar `git diff` para comprobar que el cambio incorpora el rediseño y no
   altera datos personales ni lógica de cálculo.
5. Subir cada rama actualizada y comprobar su deploy de preview. No fusionar las
   ramas personales de vuelta a `master` como parte de esta tarea.

## Límites y criterios de cierre

- No cambiar `src/lib/simulation.js` ni los datos de ninguna rama.
- No restablecer archivos a la versión de `master` para resolver conflictos.
- Mantener el UI, nombres internos y estilos del rediseño mergeado.
- La tarea termina cuando ambas ramas tienen el rediseño, sus escenarios
  originales, tests/build correctos y previews revisados.

## Pendiente

- [x] Publicar este plan en `master`. *(merge `44aac14`)*
- [x] Integrar y verificar `pelaez-amortizations`. *(merge `865f17f`, 0 commits detrás de master)*
- [x] Subir y revisar su preview.
- [x] Integrar y verificar `create-own-amortizations`. *(merge `486869e`, 0 commits detrás de master)*
- [x] Subir y revisar su preview.
