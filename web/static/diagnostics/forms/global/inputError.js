// Пометить инпут ошибкой
function inputError(selector) {
    // Если у инпута нету класса ошибки - добавляем и через 2 секунды удаляем
    if (!$(selector).hasClass("error")) {
        $(selector).addClass("error")
        setTimeout(() => {$(selector).removeClass("error")}, 2000)
    }
}