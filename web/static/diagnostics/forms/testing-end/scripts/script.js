// Функция вызывается сразу. Если ошибок не было, то удаляется вся информация о прохождении теста, но не о пользователе
(function () {
    // Если в ссылке указана ошибка "no-manager-id" со значением true, то выдает сообщение
    let URLParams = Object.fromEntries(new URLSearchParams(window.location.search))
    if (URLParams["no-manager-id"] !== undefined) {
        $("#message").text("Вы перешли по неправильной ссылке! Актуальную ссылку на тестирование попросите у профориентолога!")
        return
    }


    // Очищаем данные о прохождении если небыло никаких ошибок
    localStorage.removeItem("test-end")

    // Очищаем поля для определенного теста, а не все ответы сразу
    if (URLParams["test-name"]) {
        // 43 профессии
        if (URLParams["test-name"] === "43Professions") {
            localStorage.removeItem("questionsHash_43Professions")
            localStorage.removeItem("questionsHash_43ProfessionsOpenAnswer")
        }


        // 10 Любимых дел (Ребенок)
        if (URLParams["test-name"] === "10FavoriteThingsKid") {
            localStorage.removeItem("questionsHash_10FavoriteThingsKid")
        }

        // 10 Любимых дел (Взрослый)
        if (URLParams["test-name"] === "10FavoriteThings") {
            localStorage.removeItem("questionsHash_10FavoriteThings")
        }


        // Идеальная работа (Ребенок)
        if (URLParams["test-name"] === "perfectJobKid") {
            localStorage.removeItem("questionsHash_perfectJobKid")
        }

        // Идеальная работа (Взрослый)
        if (URLParams["test-name"] === "perfectJob") {
            localStorage.removeItem("questionsHash_perfectJob")
        }


        // Мои потребности (Ребенок)
        if (URLParams["test-name"] === "myNeedsKid") {
            localStorage.removeItem("questionsHash_myNeedsKid")
        }

        // Мои потребности (Взрослый)
        if (URLParams["test-name"] === "myNeeds") {
            localStorage.removeItem("questionsHash_myNeeds")
        }


        // Антирейтинг профессий (Ребенок)
        if (URLParams["test-name"] === "antiratingOfProfessionsKid") {
            localStorage.removeItem("questionsHash_antiratingOfProfessionsKid")
        }

        // Антирейтинг профессий (Взрослый)
        if (URLParams["test-name"] === "antiratingOfProfessions") {
            localStorage.removeItem("questionsHash_antiratingOfProfessions")
        }


        // Интервью (Ребенок)
        if (URLParams["test-name"] === "interviewKid") {
            localStorage.removeItem("questionsHash_interviewKid")
        }

        // Интервью (Взрослый)
        if (URLParams["test-name"] === "interview") {
            localStorage.removeItem("questionsHash_interview")
        }


        // 8 кадров (Ребенок)
        if (URLParams["test-name"] === "8FramesKid") {
            localStorage.removeItem("questionsHash_8FramesKid")
        }

        // 8 кадров (Взрослый)
        if (URLParams["test-name"] === "8Frames") {
            localStorage.removeItem("questionsHash_8Frames")
        }


        // Исследование ценностей
        if (URLParams["test-name"] === "exploringValues") {
            localStorage.removeItem("questionsHash_exploringValues")
        }


        // Учебная мотивация
        if (URLParams["test-name"] === "learningMotivation") {
            localStorage.removeItem("questionsHash_learningMotivation")
            localStorage.removeItem("questionsHash_learningMotivationGender")
        }

        // Диагностика жизнестойкости
        if (URLParams["test-name"] === "viability") {
            localStorage.removeItem("questionsHash_viability")
        }

        // 10 вопросов
        if (URLParams["test-name"] === "10Questions") {
            localStorage.removeItem("questionsHash_10Questions")
        }

        // Я на работе
        if (URLParams["test-name"] === "imAtWork") {
            localStorage.removeItem("questionsHash_imAtWork")
        }
    }
}())