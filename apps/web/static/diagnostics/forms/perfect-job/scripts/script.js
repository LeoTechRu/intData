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
$(".section-inputs__block input").on("input", (event) => {
    let inputId = event.currentTarget.id
    questionsHash[inputId] = $("#" + inputId).val()

    // Сохраняем ответы после записи
    localStorage.setItem("questionsHash_perfectJob", JSON.stringify(questionsHash))


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

$(".section-inputs__block input").change((event) => {
    $("#" + event.currentTarget.id).val($("#" + event.currentTarget.id).val().replace(/ +/g, ' ').trim())
})

// Триггерим инпуты, что бы при заполненых ответах кнопка разблокировалась
$(".section-inputs__block input").trigger("input")


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
            "diagnostic-id": 4, // Для этой диагностики id = 4 (Взрослая версия)
            "data": questionsHash,
            "date": Date.now() // Дата текущего прохождения
        },
        "in_archive": false,
        // "is_phone_adult": false, // Во взрослой не передаем это поле
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



// Воспроизведение гс
let audio = $(".audio")[0]
audio.muted  = false
audio.volume = 0.5

$("#audio-play").on("click tap", () => {
    if (!$("#audio-play").hasClass("play")) {
        audio.play()
    } else {
        audio.pause()
    }
    
    // Меняем иконку
    $("#audio-play").toggleClass("play")
})


// Окончание звуковой дорожки
audio.addEventListener('ended', () => {
    // Меняем иконку
    $("#audio-play").toggleClass("play")
    $("#audio-progress").css("--progress-width", "100%")

})

audio.addEventListener("timeupdate", (event) => {
    $("#audio-progress").css("--progress-width", 100 - (event.target.currentTime / event.target.duration * 100) + "%")
})

$("#audio-progress").on("click tap", (event) => {
    let width = $("#audio-progress")[0].clientWidth
    let clickX = event.offsetX
    let duration = audio.duration

    audio.currentTime = (clickX / width) * duration
})