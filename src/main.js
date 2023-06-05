const TERM = 'Plazo';
const FEE = 'Cuota';
const START_DATE = new Date(2023, 12, 5);
const mainFunction = new (function () {
  let total,
    months,
    interest,
    fixedInterest,
    variableInterest,
    initialVariableInterest,
    fixedMonths,
    years,
    type = 0;
  let euriborEvolutionUserData = [];
  let amortizationUserData = [];
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
    $('#addAmort').click(buildAmortization);
    buildEuriborEvolutionSection();
    addOwnAmortizations();
  };

  function addOwnAmortizations() {
    const firstAmortization = getFirstAmortization();
    buildAmortization(firstAmortization);
  }

  function buildEuriborEvolutionSection() {
    let euriborEvolutionTemplate = '';
    const currentYear = START_DATE.getFullYear();
    getControlsData();
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

      if (euriborSerieListLenght) {
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
    getControlsData();
    calculateAmortizations();
    const currentYear = START_DATE.getFullYear();
    months = years * 12;
    let totalInterestMonthly = (interest = 0);
    let pendingAmount = total;
    let euriborValue = euriborEvolutionUserData[0];
    let hasFixedInitialPeriod = $('.inicial input[type=checkbox]').is(':checked');
    let initialPendingAmount = `
      <tr><td>0</td><td>-</td><td>${pendingAmount.toFixed(2)}</td><td>-</td><td>-</td></tr>
    `;
    if (type == 'fijo') {
      interest = fixedInterest;
    } else if (hasFixedInitialPeriod) {
      interest = initialVariableInterest;
    } else {
      interest = variableInterest + euriborValue;
    }

    let monthlyMortgagePayment = calculateMonthlyMortaggePayment(total, months);
    for (let i = 0; i < months; i++) {
      const currentMortageYear = Math.abs(i / 12);
      const mortageYear = currentYear + currentMortageYear;
      if (typeof euriborEvolutionUserData[i] == 'number') {
        euriborValue = euriborEvolutionUserData[i];
      }
      if (type == 'variable' && (i == fixedMonths || (i > fixedMonths && typeof euriborEvolutionUserData[i] == 'number'))) {
        if (hasFixedInitialPeriod && i == fixedMonths) {
          initialPendingAmount +=
            '<tr><td colspan="5" style="font-weight:bold; color:#e24a4a; text-align:center">Fin periodo inicial fijo</tr></td>';
        }
        initialPendingAmount += `
          <tr><td colspan="5" style="font-weight:bold; text-align:center">AÑO ${mortageYear} EURIBOR: ${euriborValue} - AÑO ${currentMortageYear} DEL PRÉSTAMO</tr></td>
        `;
        interest = variableInterest + euriborValue;
        monthlyMortgagePayment = calculateMonthlyMortaggePayment(pendingAmount, months - i);
      }
      if (typeof amortizationUserData[i] == 'object') {
        let currentAmortization = amortizationUserData[i];
        initialPendingAmount +=
          `<tr> 
            <td colspan="5" style="font-weight:bold; text-align:center; color:#1E83CE">
              Amort. parcial de ${currentAmortization.cantidad} € - reducción de ${currentAmortization.tipo} <br>
            </td>
          </tr>`;
        
        if (currentAmortization.tipo == TERM) {
          months -= Math.floor(currentAmortization.cantidad / monthlyMortgagePayment);
        } else {
          monthlyMortgagePayment = monthlyMortgagePayment * (1 - currentAmortization.cantidad / pendingAmount);
        }
        pendingAmount -= currentAmortization.cantidad;
      }
      let currentInterestAmount = pendingAmount * getPeriodInterest();
      let currentCapital = monthlyMortgagePayment - currentInterestAmount;
      
      pendingAmount -= currentCapital;
      totalInterestMonthly += currentInterestAmount;
      initialPendingAmount +=
        `<tr>
          <td> ${(i + 1)}</td>
          <td> ${monthlyMortgagePayment.toFixed(2)} </td>
          <td> ${pendingAmount.toFixed(2)}</td>
          <td> ${currentCapital.toFixed(2)}</td>
          <td> ${currentInterestAmount.toFixed(2)}</td>
        </tr>`;
      if (i == 0) {
        $('#mortgageContainer')
          .html(monthlyMortgagePayment.toFixed(2) + '€')
          .parent()
          .show();
      }
      if (pendingAmount < 0) {
        break;
      }
    }
    $('#tableBody').html(initialPendingAmount);
    $('#interestTotalContainer').html(totalInterestMonthly.toFixed(2) + '€');
    $('.draw,.mortgage').show();
  };
  this.changes = function () {
    $('.draw,.mortgage').hide();
  };
  function calculateAmortizations() {
    amortizationUserData = [];
    $('.amort .am').each(function () {
      const amortizationContainer = $(this);
      const yearValue = parseInt(amortizationContainer.find('.anyo').val());
      const monthValue = parseInt(amortizationContainer.find('.mes').val());
      const quantity = parseInt(amortizationContainer.find('.capital').val());
      const amortizationType = amortizationContainer.find('.tipo').val();
      amortizationUserData[(yearValue - 1) * 12 + monthValue - 1] = {
        cantidad: quantity,
        tipo: amortizationType,
      };
    });
  }
  function buildPartialAmortizations() {
    getControlsData();
    let htmlAmortization = '<div class="am">Año:<select class="anyo" style="width:42px">';
    for (let m = 1; m <= years; m++) {
      htmlAmortization += `<option>${m}</option>`;
    }
    htmlAmortization += '</select><span>Mes:</span><select class="mes" style="width:42px">';
    for (let m = 1; m <= 12; m++) {
      htmlAmortization += `<option>${m}</option>`;
    }
    htmlAmortization += `</select>
      <span>Capital:</span>
      <input size="5" onKeyUp="mainFunction.check({target:this,type:\'int\',min:0});" value="1000" class="capital" />€
      <span>con reducción de
        <select style="width:68px" class="tipo">
          <option>${TERM}</option>
          <option>${FEE}</option>
        </select>
      </span>
      <a onclick="$(this).parent().remove(); mainFunction.changes();">Eliminar</a>
      </div>`;
    $('#amort').append(htmlAmortization);
    mainFunction.changes();
  }

  function buildAmortization(data) {
    getControlsData();
    let htmlAmortization =
      '<div class="am">Año: <select class="anyo" style="width:42px">';
    for (let year = 1; year <= years; year++) {
      const selected = year === data?.year ? 'selected' : '';
      htmlAmortization += `<option ${selected}>${year}</option>`;
    }
    htmlAmortization +=
      '</select><span>Mes: </span><select class="mes" style="width:42px">';
    for (let month = 1; month <= 12; month++) {
      const selected = month === data?.month ? 'selected' : '';
      htmlAmortization += `<option ${selected}>${month}</option>`;
    }
    htmlAmortization += `</select>
      <span>Capital: </span>
      <input size="5" value=${data?.amount ?? 1000} onKeyUp="mainFunction.check({target:this,type:\'int\',min:0});" class="capital" />€ 
      <span>con reducción de
          <select style="width:68px" class="tipo">
            <option ${data?.type === TERM ? 'selected' : ''} >${TERM}</option>
            <option ${data?.type === FEE ? 'selected' : ''} >${FEE}</option>
          </select>
        </span>
      <a onclick="$(this).parent().remove(); mainFunction.changes();">Eliminar</a>
      </div>`;
    $('#amort').append(htmlAmortization);
    mainFunction.changes();
  }

  function getControlsData() {
    total = parseInt($('#capital').val());
    years = parseInt($('#yearsField').val());
    type = $('#typeField').val().toLowerCase();
    fixedInterest = parseFloat($('#fixedInterestField').val());
    variableInterest = parseFloat($('#variableInterestField').val());
    initialVariableInterest = parseFloat($('#initialVariableInterestField').val());
    fixedMonths = parseInt($('#fixedMonthsField').val());
  }
  function getPeriodInterest() {
    return interest / 12 / 100;
  }
  function calculateMonthlyMortaggePayment(pendingAmount, pendingMonths) {
    const periodInterest = getPeriodInterest();
    const monthlyMortaggePayment = pendingAmount * ((periodInterest * Math.pow(1 + periodInterest, pendingMonths)) / (Math.pow(1 + periodInterest, pendingMonths) - 1));
    return monthlyMortaggePayment;
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

function isNumber(m) {
  return parseInt(m) === m;
}

function getEuriborSerieList() {
  return [
    2.2, 2.1, 2, 2.3, 2.4, 2.3, 2.2, 2.4, 3.1, 3.9, 4.5, 5, 5.1,
    4.7, 4.6, 4.1, 3.9, 3.5, 3, 2.4, 2.2, 2.6, 3, 3.3, 3.5, 3.6, 3.8,
    3.7, 3.8, 3.8, 3.9, 4.1, 4, 4.1, 4.1, 4.3, 4.3, 4.2, 4.3, 4.4, 4.5,
    4.2, 4.3, 4.4, 4.1, 4.3, 4.5, 4.4, 4.1, 4, 3.7
  ];
}

function getFirstAmortization() {
  return {
    year: 1,
    month: 1,
    amount: 100,
    type: FEE,
  };
}