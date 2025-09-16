// Вернуться обратно в форму
$("#button-back").on("click tap", () => {
    $("#form-aside").removeClass("hidden")
    $("#form-section").removeClass("hidden")
    $("#section-title").addClass("hidden")
    $("#section-content").addClass("hidden")

    // Класс для корректного отображения
    $("article").removeClass("article-content")
})


// Автозаполнение полей с ответами
if (isQuestionsHash) {
    for (inputId in questionsHash) {
        $("#" + inputId).val(questionsHash[inputId])
    }
}


// Сохранение ответов
$(".section-inputs__block textarea").on("input", (event) => {
    let inputId = event.currentTarget.id
    questionsHash[inputId] = $("#" + inputId).val()

    // Сохраняем ответы после записи
    localStorage.setItem("questionsHash_antiratingOfProfessionsKid", JSON.stringify(questionsHash))


    // Если всего ответов 10
    if (Object.keys(questionsHash).length === 10) {
        // Если нету пустых ответов
        if (!Object.values(questionsHash).includes("")) {
            $("#button-end").removeAttr("disabled")
        } else {
            // Если есть, то ставим кнопку неактивной
            $("#button-end").attr("disabled", "disabled")
        }
    }
})

$(".section-inputs__block textarea").change((event) => {
    $("#" + event.currentTarget.id).val($("#" + event.currentTarget.id).val().replace(/ +/g, ' ').trim())
})

// Триггерим инпуты, что бы при заполненых ответах кнопка разблокировалась
$(".section-inputs__block textarea").trigger("input")


// Отправка ответов
$("#button-end").on("click tap", () => {
    $("#button-end").attr("disabled", "disabled")
    setTimeout(() => {
        $("#button-end").removeAttr("disabled")
    }, 5000)


    // Получаем информацию о пользователе
    let userFormData = JSON.parse(localStorage.getItem("userFormData"))
    
    // Массив который отправиться
    let sendData = {
        "manager_id": parseInt(URLParams["manager-id"]),
        "name": userFormData.formName,
        "phone": userFormData.formPhone,
        "email": userFormData.formEmail,
        "new": true,
        "result": {
            "diagnostic-id": 7, // Для этой диагностики id = 7 (Детская версия)
            "data": questionsHash,
            "date": Date.now() // Дата текущего прохождения
        },
        "in_archive": false,
        "is_phone_adult": userFormData.formPhoneParents,
        "contact_permission": true,
        "date": Date.now() // Дата последней активности
    }

    
    // Api запрос в таблицу с результатами
    function DBsendResults(data, func) {
        $.ajax({
            url: API_URL + "/client/result",
            method: "POST",
            data: JSON.stringify(data),
            success: func
        })
    }

    DBsendResults(sendData, (data) => {
        // Информация отправляется и перекидывает на конец тестирования

        // Добавляем значение в хэш что бы после перезагрузки перекинуло на концовку
        localStorage.setItem("test-end", "test-end")
        location.reload()
    })
})