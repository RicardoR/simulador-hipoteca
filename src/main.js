const mainFunction = new (function () {
  let euriborEvolutionUserData = [];
  // Set when escenario.json cannot be loaded; kept visible across calculations.
  let scenarioWarning = null;
  const SCENARIO_WARNING =
    'Aviso: no se pudo cargar escenario.json; se están usando los valores por defecto.';

  this.init = function () {
    $('#typeField').change(function () {
      const selectedType = $(this).val();
      $('.variable,.fijo').hide();
      if (selectedType == '') {
        $('#calcular').hide();
      } else {
        $('.' + selectedType.toLowerCase()).show();
        $('#calcular').show();
      }
    });
    $('.euribor .title').click(function () {
      $(this).parent().toggleClass('open');
    });
    $('#calcular').click(mainFunction.getTable);
    $('#addAmort').click(function () {
      buildPartialAmortizations();
    });
    buildEuriborEvolutionSection();
    mainFunction.loadScenario();
  };

  /**
   * Phase 3: form defaults and seed amortizations live in /escenario.json, so
   * each personal branch replaces that one data file instead of touching code.
   * Fetched with a relative path (no leading slash) and applied on success;
   * on failure the HTML defaults stay and a Spanish warning is shown.
   */
  this.loadScenario = function () {
    if (typeof fetch != 'function') {
      scenarioWarning = SCENARIO_WARNING;
      renderWarnings([]);
      return Promise.resolve();
    }
    return fetch('escenario.json')
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (scenario) {
        if (!scenario || typeof scenario != 'object') throw new Error('invalid scenario');
        applyScenario(scenario);
      })
      .catch(function () {
        scenarioWarning = SCENARIO_WARNING;
        renderWarnings([]);
      });
  };
  function applyScenario(scenario) {
    if (typeof scenario.capital == 'number') $('#capital').val(scenario.capital);
    if (typeof scenario.years == 'number') $('#yearsField').val(scenario.years);
    if (scenario.type == 'fixed' || scenario.type == 'variable') {
      $('#typeField')
        .val(scenario.type == 'fixed' ? 'Fijo' : 'Variable')
        .change();
    }
    if (typeof scenario.euriborSpread == 'number') $('#variableInterestField').val(scenario.euriborSpread);
    if (typeof scenario.initialFixedInterest == 'number') $('#initialVariableInterestField').val(scenario.initialFixedInterest);
    if (typeof scenario.fixedInterest == 'number') $('#fixedInterestField').val(scenario.fixedInterest);
    if (typeof scenario.initialPeriodMonths == 'number') $('#fixedMonthsField').val(scenario.initialPeriodMonths);
    if (typeof scenario.initialPeriodActive == 'boolean') {
      $('.inicial input[type=checkbox]').prop('checked', scenario.initialPeriodActive);
    }

    // The term may have changed: rebuild the euribor sliders for the new length.
    buildEuriborEvolutionSection();

    $('#amort').empty();
    if (Array.isArray(scenario.amortizations)) {
      scenario.amortizations.forEach(function (amortization) {
        buildPartialAmortizations(amortization);
      });
    }
  }

  function buildEuriborEvolutionSection() {
    let euriborEvolutionTemplate = '';
    const currentYear = new Date().getFullYear();
    const years = getControlsData().years;
    let euriborSerieList = getEuriborSerieList();
    let counter = 0;
    let euriborSerieListLenght = euriborEvolutionUserData.length == 0;
    for (let i = currentYear; i < currentYear + years; i++) {
      const storedValue = euriborEvolutionUserData[counter * 12];
      // Bug #3: the stored value (user's or default) is the single source of
      // truth for both the slider and the calculation. It used to be rendered
      // and then unconditionally overwritten with the default series, so the
      // slider showed 5.00 while the table calculated with 2.30.
      const euriborValue = typeof storedValue == 'number' ? storedValue : euriborSerieList[counter];

      euriborEvolutionTemplate += `
        <div year="${i}">
          <span class="year">${i}</span>
          <input type="range" month="${counter * 12}" 
                 min="-0.5" max="15" step="0.1" value="${euriborValue}" />
          <span class="val">${euriborValue.toFixed(2)}</span>
        </div>
      `;

      if (typeof storedValue != 'number') {
        euriborEvolutionUserData[counter * 12] = euriborSerieList[counter];
      }
      counter++;
    }

    $('#euribor').html(euriborEvolutionTemplate);
    if (euriborSerieListLenght) {
      $('#euribor').on('input', 'input[type=range]', function () {
        const newValue = parseFloat($(this).val());
        $(this).next().html(newValue.toFixed(2));
        euriborEvolutionUserData[parseInt($(this).attr('month'))] = newValue;
      });
    }
  }

  this.getTable = function () {
    const controls = getControlsData();
    const result = calculateSimulation({
      capital: controls.capital,
      years: controls.years,
      type: controls.type,
      fixedInterest: controls.fixedInterest,
      euriborSpread: controls.euriborSpread,
      initialFixedInterest: controls.initialFixedInterest,
      initialPeriodMonths: controls.initialPeriodMonths,
      initialPeriodActive: controls.initialPeriodActive,
      euribor: euriborEvolutionUserData,
      amortizations: getAmortizationsFromDOM(),
    });
    renderResult(result);
  };
  this.changes = function () {
    $('.draw,.mortgage').hide();
  };
  function renderResult(result) {
    const currentYear = new Date().getFullYear();
    let tableHtml = '';
    result.rows.forEach(function (row) {
      tableHtml += renderRow(row, currentYear);
    });
    $('#tableBody').html(tableHtml);
    if (result.initialPayment != null) {
      $('#mortgageContainer')
        .html(result.initialPayment.toFixed(2) + '€')
        .parent()
        .show();
    }
    $('#interestTotalContainer').html(result.totalInterest.toFixed(2) + '€');
    renderWarnings(result.warnings);
    $('.draw,.mortgage').show();
  }
  function renderWarnings(warnings) {
    const texts = [];
    if (scenarioWarning) texts.push(scenarioWarning);
    warnings.forEach(function (warning) {
      texts.push(formatWarning(warning));
    });
    if (!texts.length) {
      $('#warningsContainer').html('').hide();
      return;
    }
    $('#warningsContainer')
      .html(texts.map((text) => `<div>${text}</div>`).join(''))
      .show();
  }
  function formatWarning(warning) {
    if (warning.type == 'amortization-out-of-term') {
      return `Aviso: la amortización de ${warning.amount} € del año ${warning.year}, mes ${warning.month}, está fuera del plazo de ${warning.termYears} años y no se ha tenido en cuenta.`;
    }
    if (warning.type == 'amortization-exceeds-balance') {
      return `Aviso: la amortización de ${warning.amount} € del año ${warning.year}, mes ${warning.month}, supera el saldo pendiente (${warning.balance.toFixed(2)} €): el préstamo termina en ese mes.`;
    }
    return '';
  }
  function renderRow(row, currentYear) {
    switch (row.kind) {
      case 'initial':
        return `
      <tr><td>0</td><td>-</td><td>${row.balance.toFixed(2)}</td><td>-</td><td>-</td></tr>
    `;
      case 'period-end':
        return '<tr><td colspan="5" style="font-weight:bold; color:#e24a4a; text-align:center">Fin periodo inicial fijo</tr></td>';
      case 'header':
        return `
          <tr><td colspan="5" style="font-weight:bold; text-align:center">AÑO ${currentYear + row.loanYear} EURIBOR: ${row.euribor} - AÑO ${row.loanYear} DEL PRÉSTAMO</tr></td>
        `;
      case 'amortization':
        return `<tr> 
            <td colspan="5" style="font-weight:bold; text-align:center; color:#1E83CE">
              Amort. parcial de ${row.amount} € - reducción de ${row.reduction == 'term' ? 'Plazo' : 'Cuota'} <br>
            </td>
          </tr>`;
      case 'month':
        return `<tr>
          <td> ${row.month}</td>
          <td> ${row.payment.toFixed(2)} </td>
          <td> ${row.balance.toFixed(2)}</td>
          <td> ${row.principal.toFixed(2)}</td>
          <td> ${row.interest.toFixed(2)}</td>
        </tr>`;
      default:
        return '';
    }
  }
  function buildYearOptions(years, selectedYear) {
    const selected = selectedYear == null ? null : Math.min(Math.max(selectedYear, 1), years);
    let options = '';
    for (let m = 1; m <= years; m++) {
      options += `<option${m === selected ? ' selected' : ''}>${m}</option>`;
    }
    return options;
  }
  function rebuildAmortizationYearSelects() {
    const years = getControlsData().years;
    $('.amort .am').each(function () {
      const select = $(this).find('.anyo');
      select.html(buildYearOptions(years, parseInt(select.val())));
    });
  }
  function getAmortizationsFromDOM() {
    const amortizations = [];
    $('.amort .am').each(function () {
      const amortizationContainer = $(this);
      amortizations.push({
        year: parseInt(amortizationContainer.find('.anyo').val()),
        month: parseInt(amortizationContainer.find('.mes').val()),
        amount: parseInt(amortizationContainer.find('.capital').val()),
        type: amortizationContainer.find('.tipo').val() == 'Plazo' ? 'term' : 'payment',
      });
    });
    return amortizations;
  }
  function buildPartialAmortizations(amortization) {
    const years = getControlsData().years;
    const selectedYear =
      amortization && typeof amortization.year == 'number' ? Math.min(Math.max(amortization.year, 1), years) : 1;
    const selectedMonth =
      amortization && typeof amortization.month == 'number' ? Math.min(Math.max(amortization.month, 1), 12) : 1;
    const amount = amortization && typeof amortization.amount == 'number' ? amortization.amount : 1000;
    const selectedTipo = amortization && amortization.type == 'payment' ? 'Cuota' : 'Plazo';
    let htmlAmortization = '<div class="am">Año:<select class="anyo" style="width:42px">';
    htmlAmortization += buildYearOptions(years, selectedYear);
    htmlAmortization += '</select><span>Mes:</span><select class="mes" style="width:42px">';
    for (let m = 1; m <= 12; m++) {
      htmlAmortization += `<option${m === selectedMonth ? ' selected' : ''}>${m}</option>`;
    }
    htmlAmortization +=
      `</select><span>Capital:</span> <input size="5" onKeyUp="mainFunction.check({target:this,type:\'int\',min:0});" value="${amount}" class="capital" />€ <span>con reducción de <select style="width:68px" class="tipo">` +
      `<option${selectedTipo === 'Plazo' ? ' selected' : ''}>Plazo</option>` +
      `<option${selectedTipo === 'Cuota' ? ' selected' : ''}>Cuota</option></select></span>` +
      `<a onclick="$(this).parent().remove(); mainFunction.changes();">Eliminar</a></div>`;
    $('#amort').append(htmlAmortization);
    mainFunction.changes();
  }
  function getControlsData() {
    return {
      capital: parseInt($('#capital').val()),
      years: parseInt($('#yearsField').val()),
      type: $('#typeField').val().toLowerCase() == 'fijo' ? 'fixed' : 'variable',
      fixedInterest: parseFloat($('#fixedInterestField').val()),
      euriborSpread: parseFloat($('#variableInterestField').val()),
      initialFixedInterest: parseFloat($('#initialVariableInterestField').val()),
      initialPeriodMonths: parseInt($('#fixedMonthsField').val()),
      initialPeriodActive: $('.inicial input[type=checkbox]').is(':checked'),
    };
  }
  this.check = function (amortizationObject) {
    let checkResult = false;
    if (amortizationObject.type == 'int') {
      checkResult = updateDataWhenIntDataChanged(amortizationObject);
    }
    if (amortizationObject.type == 'number') {
      checkResult = updateDataWhenNumberDataChanged(amortizationObject);
    }
    if (checkResult && amortizationObject.max == 50) {
      buildEuriborEvolutionSection();
      // Bug #7: the amortization year select follows the current term.
      rebuildAmortizationYearSelects();
    }
  };

})();
let fixParseInt = parseInt;
parseInt = function (b, a) {
  return fixParseInt(b, a || 10);
};

let initInterval = setInterval(function () {
  if (window.jQuery) {
    mainFunction.init();
    clearInterval(initInterval);
  }
}, 50);

function updateDataWhenNumberDataChanged(amortizationObject) {
  amortizationObject.target.value = amortizationObject.target.value.replace(',', '.');
  let checkResult = !isNaN(amortizationObject.target.value);
  if (checkResult) {
    checkResult =
      (typeof amortizationObject.min == 'undefined' || Number(amortizationObject.target.value) >= amortizationObject.min) &&
      (typeof amortizationObject.max == 'undefined' || Number(amortizationObject.target.value) <= amortizationObject.max);
  }
  if (checkResult) {
    amortizationObject.target.style.backgroundColor = 'white';
  } else {
    amortizationObject.target.style.backgroundColor = '#dd8585';
  }
  return checkResult;
}

function updateDataWhenIntDataChanged(amortizationObject) {
  amortizationObject.target.value = amortizationObject.target.value.replace(',', '').replace('.', '');
  let checkResult = !isNaN(amortizationObject.target.value);
  if (checkResult) {
    checkResult =
      isNumber(parseInt(amortizationObject.target.value)) &&
      (typeof amortizationObject.min == 'undefined' || parseInt(amortizationObject.target.value) >= amortizationObject.min) &&
      (typeof amortizationObject.max == 'undefined' || parseInt(amortizationObject.target.value) <= amortizationObject.max);
  }
  if (checkResult) {
    amortizationObject.target.style.backgroundColor = 'white';
  } else {
    amortizationObject.target.style.backgroundColor = '#dd8585';
  }
  return checkResult;
}

function getEuriborSerieList() {
  return [
    2.2, 2.1, 2, 2.3, 2.4, 2.3, 2.2, 2.4, 3.1, 3.9, 4.5, 5, 5.1,
    4.7, 4.6, 4.1, 3.9, 3.5, 3, 2.4, 2.2, 2.6, 3, 3.3, 3.5, 3.6, 3.8,
    3.7, 3.8, 3.8, 3.9, 4.1, 4, 4.1, 4.1, 4.3, 4.3, 4.2, 4.3, 4.4, 4.5,
    4.2, 4.3, 4.4, 4.1, 4.3, 4.5, 4.4, 4.1, 4, 3.7
  ];
}

  function isNumber(m) {
    return parseInt(m) === m;
  }
