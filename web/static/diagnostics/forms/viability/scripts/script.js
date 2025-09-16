let questionCounter = 0

function renderQuestion() {
    // Если counter равен нулю - рендерим форму входа
    if (questionCounter === 0) {
        $("#form-aside").removeClass("hidden")
        $("#form-section").removeClass("hidden")
        $("#section-instruction").addClass("hidden")
        $("#section-content").addClass("hidden")

        $("#top-right-figure").addClass("hidden")
        $("#bottom-left-figure").addClass("hidden")

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


    $("#question").text(questions[questionCounter].title);
    $("#question-counter").text(`${questionCounter}/${questions.length - 1}`);
    $("#button-next").attr("disabled", "disabled")
    $("#button-end").attr("disabled", "disabled")

    $(".grade.active").removeClass("active")
    $(".grade-circle").css("left", "0%")


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
    // Отключаем инструкцию, оставляя фигуры
    $("#section-instruction").addClass("hidden")
    $("#section-content").removeClass("hidden")

    $("#top-right-figure").removeClass("hidden")
    $("#bottom-left-figure").removeClass("hidden")

    // Рендерим первый вопрос
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
    switch (grade) {
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
    localStorage.setItem("questionsHash_viability", JSON.stringify(questions))
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
    $("#bottom-left-figure").removeClass("hidden")

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
            weight: questions[i].weight - 1, // Вычитаем единицу т.к. реальный вес меньше
        }
    }

    function summarize(directQuestions, reverseQuestions) {
        let result = 0

        // Суммируем баллы прямых вопросов (вес от 0 до 3)
        directQuestions.forEach(id => { result += answ[id].weight })

        // Суммируем баллы обратных вопросов (реверсивный вес, то есть из 3 вычитаем вес)
        reverseQuestions.forEach(id => { result += (3 - answ[id].weight) })
        return result
    }

    let involvement = summarize([4, 12, 22, 23, 24, 29, 41], [2, 3, 10, 11, 14, 28, 32, 37, 38, 40, 42])
    let control = summarize([9, 15, 17, 21, 25, 44], [1, 5, 6, 8, 16, 20, 27, 31, 35, 39, 43])
    let riskAcceptance = summarize([34, 45], [7, 13, 18, 19, 26, 30, 33, 36])
    let vitalityScore = involvement + control + riskAcceptance

    let allWeights = {
        involvement,
        control,
        riskAcceptance,
        vitalityScore
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
            "diagnostic-id": 15, // Для этой диагностики id = 15
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