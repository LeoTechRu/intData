/**
 * Вычисляем показатель выгорания p по формуле:
 *   p = sqrt( ((EE/54)^2 + (DP/30)^2 + (1 - PA/48)^2) / 3 )
 *
 * @param {number} EE Значение по шкале "Эмоциональное истощение" (0 - 54)
 * @param {number} DP Значение по шкале "Деперсонализация" (0 - 30)
 * @param {number} PA Значение по шкале "Редукция личных достижений" (0 - 48)
 * @returns {number} Итоговое значение p (0 - 1)
*/

function computeBurnout(EE, DP, PA) {
    const maxEE = 54;
    const maxDP = 30;
    const maxPA = 48;

    // Делим и возводим в квадрат
    const term1 = Math.pow(EE / maxEE, 2);
    const term2 = Math.pow(DP / maxDP, 2);
    const term3 = Math.pow(1 - (PA / maxPA), 2);

    // Усредняем и извлекаем корень
    const rho = Math.sqrt((term1 + term2 + term3) / 3);

    return rho;
}

// const EEz = 54
// const DPz = 30
// const PAz = 0

// console.log(computeBurnout(EEz, DPz, PAz).toFixed(3))
