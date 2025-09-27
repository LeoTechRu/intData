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
    localStorage.setItem("questionsHash_8FramesKid", JSON.stringify(questionsHash))


    // Если всего ответов 8
    if (Object.keys(questionsHash).length === 8) {
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
    $(".section-inputs__block textarea").trigger("input")
})

// Триггерим инпуты, что бы при заполненных ответах кнопка разблокировалась
$(".section-inputs__block textarea").trigger("input")


// Отправка ответов
$("#button-end").on("click tap", () => {
    $("#button-end").attr("disabled", "disabled")
    setTimeout(() => {
        $("#button-end").removeAttr("disabled")
    }, 5000)

    // Проверка, если не все поля заполнены
    if (Object.values(questionsHash).includes("")) {
        return
    }

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
            "diagnostic-id": 11, // Для этой диагностики id = 11 (Детская версия)
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



$(document).ready(() => {
    $(window).on("resize", function() {
        let width = document.body.clientWidth

        if (width <= 984) {
            $(".section-content__cyan-left").after($(".section-content__yellow-right"))
            $(".section-content__purple-left").after($(".section-content__cyan-right"))

        } else {
            $(".jq-second-column").append($(".section-content__yellow-right"))
            $(".jq-second-column").append($(".section-content__cyan-right"))
        }
    })

    let width = document.body.clientWidth

    if (width <= 984) {
        $(".section-content__cyan-left").after($(".section-content__yellow-right"))
        $(".section-content__purple-left").after($(".section-content__cyan-right"))
    } else {
        $(".jq-second-column").append($(".section-content__yellow-right"))
        $(".jq-second-column").append($(".section-content__cyan-right"))
    }
})