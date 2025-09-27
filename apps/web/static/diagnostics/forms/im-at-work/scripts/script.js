let questionCounter = 0

function renderQuestion() {
    // Если counter равен нулю - рендерим форму входа
    if (questionCounter === 0) {
        $("#form-aside").removeClass("hidden")
        $("#form-section").removeClass("hidden")
        $("#section-instruction").addClass("hidden")
        $("#section-content").addClass("hidden")

        $("#top-right-figure").addClass("hidden")
        $("#left-centre-figure").addClass("hidden")
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

    // Прокручиваем экран вверх
    $("article").scrollTop(0);

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
                $(".grade-circle").css("left", "0%");
                break;
            
            case 2:
                $(".grade-circle").css("left", "16.66%");
                break;

            case 3:
                $(".grade-circle").css("left", "33.33%");
                break;

            case 4:
                $(".grade-circle").css("left", "50%");
                break;

            case 5:
                $(".grade-circle").css("left", "66.66%");
                break;

            case 6:
                $(".grade-circle").css("left", "83.33%");
                break;

            case 7:
                $(".grade-circle").css("left", "100%");
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
    $("#left-centre-figure").removeClass("hidden")
    $("#bottom-right-figure").removeClass("hidden")

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
            $(".grade-circle").css("left", "0%");
            break;
        
        case 2:
            $(".grade-circle").css("left", "16.66%");
            break;

        case 3:
            $(".grade-circle").css("left", "33.33%");
            break;

        case 4:
            $(".grade-circle").css("left", "50%");
            break;

        case 5:
            $(".grade-circle").css("left", "66.66%");
            break;

        case 6:
            $(".grade-circle").css("left", "83.33%");
            break;

        case 7:
            $(".grade-circle").css("left", "100%");
            break;

        default:
            break;
    }

    // Сохраняем оценку
    localStorage.setItem("questionsHash_imAtWork", JSON.stringify(questions))
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
    $("#left-centre-figure").removeClass("hidden")
    $("#bottom-right-figure").removeClass("hidden")

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

    function summarize(directQuestions, reverseQuestions=[]) {
        let result = 0

        // Суммируем баллы прямых вопросов (вес от 0 до 6)
        directQuestions.forEach(id => { result += answ[id].weight })

        // Суммируем баллы обратных вопросов (реверсивный вес, то есть из 6 вычитаем вес)
        reverseQuestions.forEach(id => { result += (6 - answ[id].weight) })
        return result
    }

    // Только 6 вопрос оценивается обратным образом
    let emotionalExhaustion = summarize([1, 2, 3, 8, 13, 14, 16, 20], [6]) // Максимум 54
    let depersonalization = summarize([5, 10, 11, 15, 22]) // Максимум 30
    let reductionProfessionalism = summarize([4, 7, 9, 12, 17, 18, 19, 21]) // Максимум 48
    let burnout = computeBurnout(emotionalExhaustion, depersonalization, reductionProfessionalism).toFixed(3)

    let allWeights = {
        emotionalExhaustion,
        depersonalization,
        reductionProfessionalism,
        burnout
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
            "diagnostic-id": 17, // Для этой диагностики id = 17
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