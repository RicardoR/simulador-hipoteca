const mainFunction = new (function () {
  let euriborEvolutionUserData = [];
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
    $('#addAmort').click(buildPartialAmortizations);
    buildEuriborEvolutionSection();
  };

  function buildEuriborEvolutionSection() {
    let euriborEvolutionTemplate = '';
    const currentYear = new Date().getFullYear();
    const years = getControlsData().anios;
    let euriborSerieList = getEuriborSerieList();
    let counter = 0;
    let euriborSerieListLenght = euriborEvolutionUserData.length == 0;
    for (let i = currentYear; i < currentYear + years; i++) {
      let euriborValue =
        euriborSerieListLenght || !euriborEvolutionUserData[counter * 12]
          ? euriborSerieList[counter]
          : euriborEvolutionUserData[counter * 12];

      euriborEvolutionTemplate += `
        <div year="${i}">
          <span class="year">${i}</span>
          <input type="range" month="${counter * 12}" 
                 min="-0.5" max="15" step="0.1" value="${euriborValue}" />
          <span class="val">${euriborValue.toFixed(2)}</span>
        </div>
      `;

      euriborEvolutionUserData[counter * 12] = euriborSerieList[counter];
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
    const controles = getControlsData();
    const resultado = calcularSimulacion({
      capital: controles.capital,
      anios: controles.anios,
      tipo: controles.tipo,
      interesFijo: controles.interesFijo,
      spreadEuribor: controles.spreadEuribor,
      interesInicialFijo: controles.interesInicialFijo,
      mesesPeriodoInicial: controles.mesesPeriodoInicial,
      periodoInicialActivo: controles.periodoInicialActivo,
      euribor: euriborEvolutionUserData,
      amortizaciones: getAmortizationsFromDOM(),
    });
    paintResult(resultado);
  };
  this.changes = function () {
    $('.draw,.mortgage').hide();
  };
  function paintResult(resultado) {
    const currentYear = new Date().getFullYear();
    let tableHtml = '';
    resultado.filas.forEach(function (fila) {
      tableHtml += paintRow(fila, currentYear);
    });
    $('#tableBody').html(tableHtml);
    if (resultado.cuotaInicial != null) {
      $('#mortgageContainer')
        .html(resultado.cuotaInicial.toFixed(2) + '€')
        .parent()
        .show();
    }
    $('#interestTotalContainer').html(resultado.totalIntereses.toFixed(2) + '€');
    $('.draw,.mortgage').show();
  }
  function paintRow(fila, currentYear) {
    switch (fila.tipo) {
      case 'inicial':
        return `
      <tr><td>0</td><td>-</td><td>${fila.saldo.toFixed(2)}</td><td>-</td><td>-</td></tr>
    `;
      case 'fin-periodo':
        return '<tr><td colspan="5" style="font-weight:bold; color:#e24a4a; text-align:center">Fin periodo inicial fijo</tr></td>';
      case 'cabecera':
        return `
          <tr><td colspan="5" style="font-weight:bold; text-align:center">AÑO ${currentYear + fila.anyoPrestamo} EURIBOR: ${fila.euribor} - AÑO ${fila.anyoPrestamo} DEL PRÉSTAMO</tr></td>
        `;
      case 'amortizacion':
        return `<tr> 
            <td colspan="5" style="font-weight:bold; text-align:center; color:#1E83CE">
              Amort. parcial de ${fila.cantidad} € - reducción de ${fila.reduccion} <br>
            </td>
          </tr>`;
      case 'mes':
        return `<tr>
          <td> ${fila.mes}</td>
          <td> ${fila.cuota.toFixed(2)} </td>
          <td> ${fila.saldo.toFixed(2)}</td>
          <td> ${fila.capital.toFixed(2)}</td>
          <td> ${fila.interes.toFixed(2)}</td>
        </tr>`;
      default:
        return '';
    }
  }
  function getAmortizationsFromDOM() {
    const amortizaciones = [];
    $('.amort .am').each(function () {
      const amortizationContainer = $(this);
      amortizaciones.push({
        anio: parseInt(amortizationContainer.find('.anyo').val()),
        mes: parseInt(amortizationContainer.find('.mes').val()),
        cantidad: parseInt(amortizationContainer.find('.capital').val()),
        tipo: amortizationContainer.find('.tipo').val(),
      });
    });
    return amortizaciones;
  }
  function buildPartialAmortizations() {
    const years = getControlsData().anios;
    let htmlAmortization = '<div class="am">Año:<select class="anyo" style="width:42px">';
    for (let m = 1; m <= years; m++) {
      htmlAmortization += `<option>${m}</option>`;
    }
    htmlAmortization += '</select><span>Mes:</span><select class="mes" style="width:42px">';
    for (let m = 1; m <= 12; m++) {
      htmlAmortization += `<option>${m}</option>`;
    }
    htmlAmortization +=
      '</select><span>Capital:</span> <input size="5" onKeyUp="mainFunction.check({target:this,type:\'int\',min:0});" value="1000" class="capital" />€ <span>con reducción de <select style="width:68px" class="tipo"><option>Plazo</option><option>Cuota</option></select></span><a onclick="$(this).parent().remove(); mainFunction.changes();">Eliminar</a></div>';
    $('#amort').append(htmlAmortization);
    mainFunction.changes();
  }
  function getControlsData() {
    return {
      capital: parseInt($('#capital').val()),
      anios: parseInt($('#yearsField').val()),
      tipo: $('#typeField').val().toLowerCase(),
      interesFijo: parseFloat($('#fixedInterestField').val()),
      spreadEuribor: parseFloat($('#variableInterestField').val()),
      interesInicialFijo: parseFloat($('#initialVariableInterestField').val()),
      mesesPeriodoInicial: parseInt($('#fixedMonthsField').val()),
      periodoInicialActivo: $('.inicial input[type=checkbox]').is(':checked'),
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
