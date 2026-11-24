# simulador-hipoteca

Simulador de hipoteca en español: calcula la cuota, compara escenarios y observa cómo las amortizaciones parciales cambian el plazo, la deuda y los intereses. Tipo fijo o variable (con revisión anual y periodo inicial fijo opcional), evolución del euríbor editable año a año y cuadro de amortización completo.

Aplicación estática **React + Vite**: no hay backend; el cálculo vive en `src/lib/simulation.js` (sin DOM, sin framework) y el estado en un único reducer (`src/state.js`).

## Uso

```bash
npm install
npm run dev      # servidor de desarrollo (http://localhost:5173)
npm test         # suite de Vitest (test/)
npm run build    # build de producción → dist/
npm run preview  # sirve dist/ (http://localhost:4173)
```

## Escenarios: `public/escenario.json`

La app carga `escenario.json` al arrancar y con él prellena el formulario y las amortizaciones. Si el fichero no se puede cargar, se usan los valores por defecto y se muestra un aviso.

Cada rama personal sustituye este único fichero de datos en lugar de editar código (campos: `capital`, `years`, `type`, `fixedInterest`, `euriborSpread`, `initialFixedInterest`, `initialPeriodMonths`, `initialPeriodActive`, `startDate` ISO opcional y `amortizations`).

## Despliegue

Cada push a master despliega en Vercel (`vercel.json` fija install/build/output, así el deploy no depende de la configuración del dashboard). No hay CI: antes de pushear, `npm test` y `npm run build` en local.
