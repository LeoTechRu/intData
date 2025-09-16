// Получить актуальную информацию о профиле
function DBgetUserData(auth) {
    $.ajax({
        url: API_URL + "/manager",
        method: "GET",
        headers: {
            "Authorization": "Basic " + auth
        },
        success: (data) => {
            if (data.is_full_access) {
                // Если доступ есть - убираем модальное окно и блюр
                $("article").removeClass("article-blur")
                $(".access-wrapper").remove()
            } else {
                noAccessError()
            }

        },
        error: () => {
            // Если не получилось авторизоваться
            noAuthDataError()
        }
    })
}

// Нету доступа
function noAccessError() {
    $("section:not(#section-form)").remove()
    $(".access__title").text("Доступ закрыт")
    $(".access__text").html("Автоматизация подготовки заключения доступна при работе по Франшизе 3.0.\n\nУзнать условия перехода на Франшизу 3.0. вы можете у наших менеджеров по тел. <span>+7 987 815 70 80</span>")
}

// Если нету данных для входа
function noAuthDataError() {
    $("section:not(#section-form)").remove()
    $(".access").css("height", "auto") // Ставим высоту auto
    $(".access__title").text("Доступ закрыт")
    $(".access__text").html("Пожалуйста, перейдите на страницу с заключением через личный кабинет!\n\nАвтоматизация подготовки заключения доступна при работе по Франшизе 3.0.\n\nУзнать условия перехода на Франшизу 3.0. вы можете у наших менеджеров по тел. <span>+7 987 815 70 80</span>")
}

// Если данные для входа в ссылке
const urlParams = new URLSearchParams(window.location.search)
if (urlParams.get("auth")) {
    // Сохраняем данные для входа
    localStorage.auth = urlParams.get("auth")
    
    // Удаляем из ссылки данные для входа
    history.pushState(null, null, '/')
    DBgetUserData(urlParams.get("auth"))
} else if (localStorage.auth) { // Если нету - проверка из памяти
    DBgetUserData(localStorage.auth)
} else {
    // Если нету данных для проверки
    noAuthDataError()
}