let questionCounter = 1

function renderQuestion() {
    // Если counter равен нулю - рендерим форму входа
    if (questionCounter === 0) {
        $("#form-aside").removeClass("hidden")
        $("#form-section").removeClass("hidden")
        $("#section-instruction").addClass("hidden")
        $("#section-gender").addClass("hidden")
        $("#section-content").addClass("hidden")

        $("#top-right-figure").addClass("hidden")
        $("#center-left-figure").addClass("hidden")
        $("#bottom-left-figure").addClass("hidden")
        $("#bottom-right-figure").addClass("hidden")

        // Класс для корректного отображения
        $("article").removeClass("article-content")
        return
    }


    if (questionCounter === questions.length - 1) {
        // Если counter равен последнему вопросу - рендерим кнопку завершения
        $("#button-next").addClass("hidden")
        $("#button-end").removeClass("hidden")
    } else {
        $("#button-next").removeClass("hidden")
        $("#button-end").addClass("hidden")
    }


    $("#question").text(questions[questionCounter]["title_" + gender]);
    $("#question-counter").text(`${questionCounter}/${questions.length - 1}`);
    $("#button-next").attr("disabled", "disabled")
    $("#button-end").attr("disabled", "disabled")

    $(".grade.active").removeClass("active")
    $(".grade-circle").css("left", "0%")



    $("#form-aside").addClass("hidden")
    $("#form-section").addClass("hidden")
    $("#section-instruction").addClass("hidden")
    $("#section-gender").addClass("hidden")
    $("#section-content").removeClass("hidden")

    $("#top-right-figure").removeClass("hidden")
    $("#center-left-figure").removeClass("hidden")
    $("#center-left-figure").addClass("figure-phone-hidden")
    $("#bottom-left-figure").addClass("hidden")
    $("#bottom-right-figure").addClass("hidden")


    // Если ответ есть - активируем нужную оценку
    if (questions[questionCounter].weight !== 0) {
        $("#button-next").removeAttr("disabled")
        $("#button-end").removeAttr("disabled")
        $("#grade-" + questions[questionCounter].weight).addClass("active")

        // Перемещение значения на полосе
        switch (questions[questionCounter].weight) {
            case 1:
                $(".grade-circle").css("left", "0%")
                break;
            
            case 2:
                $(".grade-circle").css("left", "33%")
                break;

            case 3:
                $(".grade-circle").css("left", "66%")
                break;

            case 4:
                $(".grade-circle").css("left", "100%")
                break;
        
            default:
                break;
        }
    }
}


// Начать тестирование
$("#submit-instruction").on("click tap", () => {
    // Отключаем инструкцию, оставляя заголовок и фигуру сверху справа
    // Если counter равен нулю - рендерим форму с выбором пола
    
    $("#form-aside").addClass("hidden")
    $("#form-section").addClass("hidden")
    $("#section-instruction").addClass("hidden")
    $("#section-gender").removeClass("hidden")
    $("#section-content").addClass("hidden")

    $("#top-right-figure").removeClass("hidden")
    $("#center-left-figure").removeClass("hidden")
    $("#center-left-figure").removeClass("figure-phone-hidden")
    $("#bottom-left-figure").removeClass("hidden")
    $("#bottom-right-figure").removeClass("hidden")

    // Класс для корректного отображения
    $("article").addClass("article-content")
})


// Кнопка Мужской пол
$("#button-boy").on("click tap", () => {
    // Сохраняем выбор
    localStorage.setItem("questionsHash_learningMotivationGender", "boy")
    gender = "boy"
    questionCounter = 1
    renderQuestion()
})

// Кнопка Женский пол
$("#button-girl").on("click tap", () => {
    // Сохраняем выбор
    localStorage.setItem("questionsHash_learningMotivationGender", "girl")
    gender = "girl"
    questionCounter = 1
    renderQuestion()
})


// Кнопка назад
$("#button-back").on("click tap", () => {
    questionCounter--
    renderQuestion()
})


// Кнопка вперед
$("#button-next").on("click tap", () => {
    questionCounter++
    renderQuestion()
})


// Нажатие по оценке
$(".grade").on("click tap", (event) => {
    $(".grade.active").removeClass("active")
    $("#" + event.currentTarget.id).addClass("active")

    let grade = parseInt(event.currentTarget.id.split("-")[1])
    questions[questionCounter].weight = grade

    // Включаем кнопку
    $("#button-next").removeAttr("disabled")
    $("#button-end").removeAttr("disabled")


    // Перемещение значения на полосе
    switch (questions[questionCounter].weight) {
        case 1:
            $(".grade-circle").css("left", "0%")
            break;
        
        case 2:
            $(".grade-circle").css("left", "33%")
            break;

        case 3:
            $(".grade-circle").css("left", "66%")
            break;

        case 4:
            $(".grade-circle").css("left", "100%")
            break;
    
        default:
            break;
    }

    // Сохраняем оценку
    localStorage.setItem("questionsHash_learningMotivation", JSON.stringify(questions))
})



// Если ответы сохранены - переносим на последний ответивший вопрос +1
if (isQuestionsHash) {
    for (element of questions) {
        if (element.weight !== 0) {
            questionCounter = element.id + 1 // Записываем в текущий вопрос следующий вопрос после последнего ответа
        }
    }

    if (questionCounter === questions.length) {
        questionCounter = questions.length - 1
    }

    // Включаем контейнер вопросов
    $("#form-aside").addClass("hidden")
    $("#form-section").addClass("hidden")
    $("#section-content").removeClass("hidden")

    $("#top-right-figure").removeClass("hidden")
    $("#center-left-figure").removeClass("hidden")
    $("#center-left-figure").addClass("figure-phone-hidden")

    // Класс для корректного отображения
    $("article").addClass("article-content")

    renderQuestion()
}


// Отправка ответов
$("#button-end").on("click tap", () => {
    $("#button-end").attr("disabled", "disabled")
    setTimeout(() => {
        $("#button-end").removeAttr("disabled")
    }, 5000)


    // Создаем массив содержащий все ответы
    let answ = {}
    for (let i = 1; i < questions.length; i++) {
        answ[i] = {
            weight: questions[i].weight,
        }
    }


    // Собираем вес средних результатов
    let сognitiveActivity = answ[2].weight + answ[6].weight + answ[10].weight + (5 - answ[14].weight) + answ[18].weight + answ[22].weight + answ[26].weight + (5 - answ[30].weight) + answ[34].weight + (5 - answ[38].weight)
    let achievementMotivation = (5 - answ[4].weight) + answ[8].weight + answ[12].weight + answ[16].weight + (5 - answ[20].weight) + answ[24].weight + answ[28].weight + (5 - answ[32].weight) + answ[36].weight + answ[40].weight
    let anxiety = (5 - answ[1].weight) + answ[5].weight + (5 - answ[9].weight) + answ[13].weight + answ[17].weight + answ[21].weight + (5 - answ[25].weight) + answ[29].weight + (5 - answ[33].weight) + answ[37].weight
    let anger = answ[3].weight + answ[7].weight + answ[11].weight + answ[15].weight + answ[19].weight + answ[23].weight + answ[27].weight + answ[31].weight + answ[35].weight + answ[39].weight
    let levelOfMotivation = сognitiveActivity + achievementMotivation - anxiety - anger
    
    
    let allWeights = {
        сognitiveActivity: сognitiveActivity,
        achievementMotivation: achievementMotivation,
        anxiety: anxiety,
        anger: anger,
        levelOfMotivation: levelOfMotivation
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
            "diagnostic-id": 14, // Для этой диагностики id = 14
            "data": allWeights,
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