const EURIBOR = 2.2;

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
    $('#tipo').change(function () {
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

  // todo: refactor me please!
  function buildEuriborEvolutionSection() {
    var euriborEvolutionTemplate = '';
    const currentYear = new Date().getFullYear();
    getControlsData();
    var euriborSerieList = getEuriborSerieList();
    var counter = 0;
    var euriborSerieListLenght = euriborEvolutionUserData.length == 0;
    for (i = currentYear; i < currentYear + years; i++) {
      var euriborValue =
        euriborSerieListLenght || !euriborEvolutionUserData[counter * 12]
          ? euriborSerieList[counter]
          : euriborEvolutionUserData[counter * 12];

      euriborEvolutionTemplate += `
        <div year="${i}">
          <span class="year">${i}</span>
          <input type="range" month="${counter * 12}" 
                 min="-0.5" max="6" step="0.1" value="${euriborValue}" />
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
        var newValue = parseFloat($(this).val());
        $(this).next().html(newValue.toFixed(2));
        euriborEvolutionUserData[parseInt($(this).attr('month'))] = newValue;
      });
    }
  }

  this.getTable = function () {
    getControlsData();
    calculateAmortizations();
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
    } else {
      if (hasFixedInitialPeriod) {
        interest = initialVariableInterest;
      } else {
        interest = variableInterest + euriborValue;
      }
    }
    let monthlyMortgagePayment = calculateMonthlyMortaggePayment(total, months);
    for (i = 0; i < months; i++) {
      if (typeof euriborEvolutionUserData[i] == 'number') {
        euriborValue = euriborEvolutionUserData[i];
      }
      if (type == 'variable' && (i == fixedMonths || (i > fixedMonths && typeof euriborEvolutionUserData[i] == 'number'))) {
        if (hasFixedInitialPeriod && i == fixedMonths) {
          initialPendingAmount +=
            '<tr><td colspan="5" style="font-weight:bold; color:#e24a4a; text-align:center">Fin periodo inicial fijo</tr></td>';
        }
        initialPendingAmount += `
          <tr><td colspan="5" style="font-weight:bold; text-align:center">EURIBOR: ${euriborValue}</tr></td>
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
        
        if (currentAmortization.tipo == 'Plazo') {
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
        $('#cuota')
          .html(monthlyMortgagePayment.toFixed(2) + '€')
          .parent()
          .show();
      }
      if (pendingAmount < 0) {
        break;
      }
    }
    $('#cuadro').html(initialPendingAmount);
    $('#total_intereses').html(totalInterestMonthly.toFixed(2) + '€');
    $('.draw,.cuota').show();
  };
  this.changes = function () {
    $('.draw,.cuota').hide();
  };
  function calculateAmortizations() {
    amortizationUserData = [];
    $('.amort .am').each(function () {
      const amortizationContainer = $(this);
      const yearValue = parseInt(amortizationContainer.find('.anyo').val());
      const monthValue = parseInt(amortizationContainer.find('.mes').val());
      const quantity = parseInt(amortizationContainer.find('.capital').val());
      var amortizationType = amortizationContainer.find('.tipo').val();
      amortizationUserData[(yearValue - 1) * 12 + monthValue - 1] = {
        cantidad: quantity,
        tipo: amortizationType,
      };
    });
  }
  function buildPartialAmortizations() {
    getControlsData();
    let htmlAmortization = '<div class="am">Año:<select class="anyo" style="width:42px">';
    for (var m = 1; m <= years; m++) {
      htmlAmortization += `<option>${m}</option>`;
    }
    htmlAmortization += '</select><span>Mes:</span><select class="mes" style="width:42px">';
    for (var m = 1; m <= 12; m++) {
      htmlAmortization += `<option>${m}</option>`;
    }
    htmlAmortization +=
      '</select><span>Capital:</span> <input size="5" onKeyUp="mainFunction.check({target:this,type:\'int\',min:0});" value="1000" class="capital" />€ <span>con reducción de <select style="width:68px" class="tipo"><option>Plazo</option><option>Cuota</option></select></span><a onclick="$(this).parent().remove(); mainFunction.changes();">Eliminar</a></div>';
    $('#amort').append(htmlAmortization);
    mainFunction.changes();
  }
  function getControlsData() {
    total = parseInt($('#capital').val());
    years = parseInt($('#anyos').val());
    type = $('#tipo').val().toLowerCase();
    fixedInterest = parseFloat($('#interesfijo').val());
    variableInterest = parseFloat($('#interesvariable').val());
    initialVariableInterest = parseFloat($('#interesvariableinicial').val());
    fixedMonths = parseInt($('#mesesfijo').val());
  }
  function getPeriodInterest() {
    return interest / 12 / 100;
  }
  function calculateMonthlyMortaggePayment(pendingAmount, pendingMonths) {
    var periodInterest = getPeriodInterest();
    var monthlyMortaggePayment = pendingAmount * ((periodInterest * Math.pow(1 + periodInterest, pendingMonths)) / (Math.pow(1 + periodInterest, pendingMonths) - 1));
    return monthlyMortaggePayment;
  }
  this.check = function (amortizationObject) {
    let checkResult = false;
    if (amortizationObject.type == 'int') {
      amortizationObject.target.value = amortizationObject.target.value.replace(',', '').replace('.', '');
      checkResult = !isNaN(amortizationObject.target.value);
      if (checkResult) {
        checkResult =
          e(parseInt(amortizationObject.target.value)) &&
          (typeof amortizationObject.min == 'undefined' || parseInt(amortizationObject.target.value) >= amortizationObject.min) &&
          (typeof amortizationObject.max == 'undefined' || parseInt(amortizationObject.target.value) <= amortizationObject.max);
      }
      if (checkResult) {
        amortizationObject.target.style.backgroundColor = 'white';
      } else {
        amortizationObject.target.style.backgroundColor = '#dd8585';
      }
    }
    if (amortizationObject.type == 'number') {
      amortizationObject.target.value = amortizationObject.target.value.replace(',', '.');
      checkResult = !isNaN(amortizationObject.target.value);
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
    }
    if (checkResult && amortizationObject.max == 50) {
      buildEuriborEvolutionSection();
    }
  };
  function e(m) {
    return parseInt(m) === m;
  }
})();
var fixParseInt = parseInt;
parseInt = function (b, a) {
  return fixParseInt(b, a || 10);
};

var initInterval = setInterval(function () {
  if (window.jQuery) {
    mainFunction.init();
    clearInterval(initInterval);
  }
}, 50);

function getEuriborSerieList() {
  return [
    EURIBOR, 2.1, 2, 2.3, 2.4, 2.3, 2.2, 2.4, 3.1, 3.9, 4.5, 5, 5.1,
    4.7, 4.6, 4.1, 3.9, 3.5, 3, 2.4, 2.2, 2.6, 3, 3.3, 3.5, 3.6, 3.8,
    3.7, 3.8, 3.8, 3.9, 4.1, 4, 4.1, 4.1, 4.3, 4.3, 4.2, 4.3, 4.4, 4.5,
    4.2, 4.3, 4.4, 4.1, 4.3, 4.5, 4.4, 4.1, 4, 3.7
  ];
}
