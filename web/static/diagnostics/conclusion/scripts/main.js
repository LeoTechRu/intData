import { vectors } from "./vectors.js"

const demoText = `Мы рекомендуем в каждом поле давать следующее описание варианта обучения:
1. Название места (ВУЗ, колледж, онлайн - университет и прочее)
2. Название программы обучения.
3. Ссылка на сайт, где можно почитать подробности.

Пример описания, которое добавляем в поле ниже:
НИУ ВШЭ, программа «Реклама и связи с общественностью» в НИУ ВШЭ (5 место в рейтинге). Сайт: https://www.hse.ru/ba/ad/admission/`

// Текущая дата в инпуте даты
$("#form-date").val(moment().format("YYYY-MM-DD"))


// Открытие кабинета по нажатию на логотип
$("#top-left-logo").on("click tap", () => {
    location.href = CABINET_URL
})

// Выбранные города
let cities = []

let pageCounterShow = 1
let pageMax = 11

let pageCounter = 1
renderPage() 

function renderPage() {
    pageCounterShow = pageCounter

    // Если не давать рекомендации
    if ($("#prepare-conclusion-no").hasClass("active")) {
        pageMax = 7

        if (pageCounter === 10) {
            pageCounterShow = 6
        }

        if (pageCounter === 11) {
            pageCounterShow = 7
        }
    } else {
        pageMax = 11
    }

    $("#page-counter").text(`${pageCounterShow}/${pageMax}`);

    $(".svg-figure").addClass("hidden")

    $("#button-next").removeClass("hidden")
    $("#button-download").addClass("hidden")
    $("#top-left-logo").removeClass("hidden")

    // Если counter равен нулю - рендерим первую страницу
    switch (pageCounter) {
        case 1: 
            // Блокируем кнопку назад
            $("#button-back").attr("disabled", true)
            $("#button-next").removeAttr("disabled")
            
            $("#svg-yellow-circle").removeClass("hidden")

            $("section").addClass("hidden")
            $("#section-form").removeClass("hidden")
            break;

        case 2:
            // Разблокируем кнопку назад
            $("#button-back").removeAttr("disabled")

            $("#svg-purple-polygon").removeClass("hidden")
            $("#svg-green-triangle").removeClass("hidden")

            $("section").addClass("hidden");
            $("#section-vector-selection").removeClass("hidden")

            // Включаем кнопку если выбран хотя бы один вектор
            if (vectors.filter(vector => vector.active).length) {
                $("#button-next").removeAttr("disabled")
            } else {
                $("#button-next").attr("disabled", true)
            }
            break;
        
        case 3:
            renderBestVectors()

            $("#svg-purple-polygon").removeClass("hidden")
            $("#svg-green-triangle").removeClass("hidden")

            $("section").addClass("hidden")
            $("#section-vector-best").removeClass("hidden")
            
            // Включаем кнопку если выбран хотя бы один лучший вектор из выбранных
            if (vectors.filter(vector => vector.best).filter(vector => vector.active).length) {
                $("#button-next").removeAttr("disabled")
            } else {
                $("#button-next").attr("disabled", true)
            }
            break;
        
        case 4:
            renderJobs()

            $("#svg-yellow-circle").removeClass("hidden")
            $("#svg-green-quadrilateral").removeClass("hidden")

            $("section").addClass("hidden")
            $("#section-vector-jobs").removeClass("hidden")

            // Включаем кнопку если выбрана хотя бы одна профессия в каждом столбце
            if (vectors.filter(vector => vector.active).filter(vector => vector.jobs.filter(job => job.active).length).length === vectors.filter(vector => vector.active).length) {
                $("#button-next").removeAttr("disabled")
            } else {
                $("#button-next").attr("disabled", true)
            }
            break

        case 5:
            $("#svg-yellow-circle").removeClass("hidden")
            $("#svg-green-quadrilateral").removeClass("hidden")

            $("section").addClass("hidden")
            $("#section-prepare-conclusion").removeClass("hidden")

            // Включаем кнопку если выбран хотя бы один вариант
            if ($("#section-prepare-conclusion button.active").length) {
                $("#button-next").removeAttr("disabled")
            } else {
                $("#button-next").attr("disabled", true)
            }
            break

        case 6:
            $("#svg-yellow-circle").removeClass("hidden")
            $("#svg-green-quadrilateral").removeClass("hidden")

            $("section").addClass("hidden")
            $("#section-training-options").removeClass("hidden")

            // Включаем кнопку если выбран хотя бы один вариант
            if ($("#section-training-options button.active").length) {
                $("#button-next").removeAttr("disabled")
            } else {
                $("#button-next").attr("disabled", true)
            }
            break
        
        case 7:
            $("#svg-yellow-circle").removeClass("hidden")
            $("#svg-green-quadrilateral").removeClass("hidden")

            $("section").addClass("hidden")
            $("#section-city").removeClass("hidden")

            // Включаем кнопку если есть хотя бы один город
            if (cities[0]) {
                $("#button-next").removeAttr("disabled")
            } else {
                $("#button-next").attr("disabled", true)
            }
            break

        case 8:
            $("#svg-green-square").removeClass("hidden")
            $("#svg-yellow-polygon").removeClass("hidden")

            $("section").addClass("hidden")
            $("#section-paid-forms").removeClass("hidden")

            // Включаем кнопку если выбран хотя бы один вариант
            if ($("#section-paid-forms button.active").length) {
                $("#button-next").removeAttr("disabled")
            } else {
                $("#button-next").attr("disabled", true)
            }
            break

        case 9:
            $("#svg-yellow-triangle").removeClass("hidden")
            $("#svg-green-polygon").removeClass("hidden")

            $("section").addClass("hidden")
            $("#section-institutions").removeClass("hidden")

            // Если текст не демо и не пустой, то разблокируем кнопку
            $("#button-next").attr("disabled", true)

            $(".textarea-wrapper:not(.demo)").each((index, element) => {
                if ($(element).find("textarea").val().trim()) {
                    $("#button-next").removeAttr("disabled")
                }
            })
            break

        case 10:
            $("#svg-yellow-circle").removeClass("hidden")
            $("#svg-green-polygon").removeClass("hidden")

            $("section").addClass("hidden")
            $("#section-comment").removeClass("hidden")

            $("#button-next").removeAttr("disabled")
            break

        case 11:
            renderPDF()

            $("section").addClass("hidden")
            $("#section-pdf").removeClass("hidden")

            $("#button-next").attr("disabled", true) 
            $("#button-next").addClass("hidden") // Скрываем кнопку Далее
            $("#top-left-logo").addClass("hidden") // Скрываем логотип

            $("#button-download").removeClass("hidden") // Показываем кнопку загрузки
            break

        default:
            break;
    }
}

document.addEventListener("DOMContentLoaded", () => {

// Кнопка назад
$("#button-back").on("click tap", () => {
    // Если на 10 странице нажать назад, то проверяем активна ли подготовка заключения
    if (pageCounter === 10 && $("#prepare-conclusion-no").hasClass("active")) {
        pageCounter = 5
        renderPage()
        return
    }

    pageCounterShow--
    pageCounter--
    renderPage()
})

// Кнопка вперед
$("#button-next").on("click tap", () => {
    // Если первая страница, то кнопка далее активируем форму
    if (pageCounter === 1) {
        $("#form-button").click()
        return
    }

    // Если на 5 странице выбрали не подготавливать заключение, то перекинет на конец
    if (pageCounter === 5 && $("#prepare-conclusion-no").hasClass("active")) {
        pageCounter = 10
        renderPage()
        return
    }

    pageCounterShow++
    pageCounter++
    renderPage()
})

});


// Пометить инпут ошибкой
function inputError(selector) {
    // Если у инпута нету класса ошибки - добавляем и через 2 секунды удаляем
    if (!$(selector).hasClass("error")) {
        $(selector).addClass("error")
        setTimeout(() => {$(selector).removeClass("error")}, 2000)
    }
}

// Первая страница - Валидация формы
$("#form-client").change(() => { // Удаление лишних пробелов
    $("#form-client").val($("#form-client").val().replace(/ +/g, " ").trim())
})

$("#form-expert").change(() => { // Удаление пробелов
    $("#form-expert").val($("#form-expert").val().replace(/ /g, " ").trim())
})


// Ивент submit у формы входа
const form = document.querySelector("form")
form.addEventListener("submit", (event) => {
    // Отключение базового перехода
    event.preventDefault()

    // Получаем поля из фомы
    const formData = new FormData(form)
    const formClient = formData.get("form-client")
    const formExpert = formData.get("form-expert")
    const formDate = formData.get("form-date")
    
    // В поле ФИО клиента должно быть не меньше 3 слов
    if (formClient.split(" ").length < 3) {
        inputError("#form-client")

        // Ставим текст ошибки
        $("#form-error").text("Неверный формат ФИО клиента")
        $("#form-error").addClass("show")
        setTimeout(() => {
            $("#form-error").removeClass("show")
        }, 2000)
        return
    }

    // В поле ФИО должно быть не меньше 3 слов
    if (formExpert.split(" ").length < 3) {
        inputError("#form-expert")

        // Ставим текст ошибки
        $("#form-error").text("Неверный формат ФИО эксперта")
        $("#form-error").addClass("show")
        setTimeout(() => {
            $("#form-error").removeClass("show")
        }, 2000)
        return
    }

    if (!formDate) {
        inputError("#form-date")

        // Ставим текст ошибки
        $("#form-error").text("Не указана дата заполнения")
        $("#form-error").addClass("show")
        setTimeout(() => {
            $("#form-error").removeClass("show")
        }, 2000)
        return
    }

    // Если все без ошибок, то перекинет на вторую страницу
    pageCounter = 2
    renderPage() 
})


// Вторая страница - рендер всех векторов
function renderVectors() {
    $("#section-vector-selection .content .vector-column").empty()
    for (let vector of vectors) {
        // Первые 7 элементов в первую колонную, остальные во вторую
        $(`#section-vector-selection .content #vector-column-${vector.id < 7 ? "1" : "2"}`).append(`
            <div class="vector-wrapper" id="vector-${vector.id}">
                <div class="input-checkbox">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <rect x="0.5" y="0.5" width="19" height="19" rx="3.5" fill="#BD92CE" stroke="#BD92CE"/>
                        <path d="M8 14.4L4 10.4L5.4 9L8 11.6L14.6 5L16 6.4L8 14.4Z" fill="white"/>
                    </svg>
                </div>
                <p>${vector.cutTitle}</p>
            </div>
        `)
    }


    // Нажатие по вектору
    $(".vector-wrapper").unbind("click tap")
    $(".vector-wrapper").on("click tap", (event) => {
        // Массив выбранных векторов
        const activeVectors = vectors.filter(vector => vector.active)

        // Если выбрано 4 вектора
        if (activeVectors.length === 4) {
            // Если нажать на вектор который уже выбран, то выбор отменится и далее можно будет выбрать новый
            if ($("#" + event.currentTarget.id).hasClass("active")) {
                $("#" + event.currentTarget.id).removeClass("active")

                // Убираем активность в массиве
                vectors[event.currentTarget.id.split("-")[1]].active = false
            }
        } else {
            $("#" + event.currentTarget.id).toggleClass("active")
            // Добавляем / Убираем активность в массиве
            vectors[event.currentTarget.id.split("-")[1]].active = !vectors[event.currentTarget.id.split("-")[1]].active
        }


        // Включаем кнопку если выбран хотя бы один вектор
        if (vectors.filter(vector => vector.active).length) {
            $("#button-next").removeAttr("disabled")
        } else {
            $("#button-next").attr("disabled", true)
        }
    })
}

renderVectors()


// Третья страница - рендер выбранных векторов
function renderBestVectors() {
    $("#section-vector-best .content").empty()

    // Массив выбранных векторов
    const activeVectors = vectors.filter(vector => vector.active)

    for (let vector of activeVectors) {
        $("#section-vector-best .content").append(`
            <div class="vector-best-wrapper ${vector.best ? "active" : ""}" id="vector-best-${vector.id}">
                <div class="input-radio"></div>
                <p>${vector.cutTitle}</p>
            </div>
        `)
    }


    // Нажатие по вектору
    $(".vector-best-wrapper").unbind("click tap")
    $(".vector-best-wrapper").on("click tap", (event) => {
        $(".vector-best-wrapper").removeClass("active")
        $("#" + event.currentTarget.id).toggleClass("active")

        // Обнуляем все "лучшие" вектора и ставим выбранный
        for (let vector in vectors) {
            vectors[vector].best = false
        }
        vectors[event.currentTarget.id.split("-")[2]].best = true

        // Включаем кнопку если выбран хотя бы один лучший вектор из выбранных
        if (vectors.filter(vector => vector.best).filter(vector => vector.active).length) {
            $("#button-next").removeAttr("disabled")
        } else {
            $("#button-next").attr("disabled", true)
        }
    })
}


// Четвертая страница - рендер профессий в выбранных векторах
function renderJobs() {
    $("#section-vector-jobs .content").empty()

    // Массив выбранных векторов
    const activeVectors = vectors.filter(vector => vector.active)

    for (let vector of activeVectors) {
        $("#section-vector-jobs .content").append(`
            <div class="vector-jobs__container" id="jobs-container-${vector.id}">
                <p class="vector-jobs__container-title">${vector.cutTitle}</p>
                <div class="vector-jobs__wrapper">
                    <div class="vector-jobs__content"></div>
                </div>
            </div>
        `);

        for (let job in vector.jobs) {
            $(`#jobs-container-${vector.id} .vector-jobs__wrapper .vector-jobs__content`).append(`
                <div class="job-wrapper ${vector.jobs[job].active ? "active" : ""}" id="vector-${vector.id}-job-${job}">
                    <div class="input-checkbox">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <rect x="0.5" y="0.5" width="19" height="19" rx="3.5" fill="#BD92CE" stroke="#BD92CE"/>
                            <path d="M8 14.4L4 10.4L5.4 9L8 11.6L14.6 5L16 6.4L8 14.4Z" fill="white"/>
                        </svg>
                    </div>
                    ${vector.jobs[job].title 
                        ? `<p>${vector.jobs[job].title}</p>`
                        : `<div contenteditable class="job-contenteditable" id="vector-${vector.id}-jobinput-${job}">${vector.jobs[job].input}</div>`
                    }
                </div>
            `)
        }
    }

    // Сохранение введенной работы
    $(".job-contenteditable").unbind("input")
    $(".job-contenteditable").on("input", (event) => {
        vectors[event.currentTarget.id.split("-")[1]].jobs[event.currentTarget.id.split("-")[3]].input = $(event.currentTarget).text()
    })

    // Нажатие по вектору
    $(".job-wrapper").unbind("click tap")
    $(".job-wrapper").on("click tap", (event) => {
        // Массив выбранных работ в векторе
        let activeJobs = vectors[event.currentTarget.id.split("-")[1]].jobs.filter(job => job.active)

        // Если выбрано 3 работы
        if (activeJobs.length === 5) {
            // Если нажать на вектор который уже выбран, то выбор отменится и далее можно будет выбрать новый
            if ($("#" + event.currentTarget.id).hasClass("active")) {
                $("#" + event.currentTarget.id).removeClass("active")

                // Убираем активность в массиве
                vectors[event.currentTarget.id.split("-")[1]].jobs[event.currentTarget.id.split("-")[3]].active = false
            }
        } else {
            $("#" + event.currentTarget.id).toggleClass("active")
            // Добавляем / Убираем активность в массиве
            vectors[event.currentTarget.id.split("-")[1]].jobs[event.currentTarget.id.split("-")[3]].active = !vectors[event.currentTarget.id.split("-")[1]].jobs[event.currentTarget.id.split("-")[3]].active
        }


        // Включаем кнопку если выбрана хотя бы одна профессия в каждом столбце
        if (vectors.filter(vector => vector.active).filter(vector => vector.jobs.filter(job => job.active).length).length === vectors.filter(vector => vector.active).length) {
            $("#button-next").removeAttr("disabled")
        } else {
            $("#button-next").attr("disabled", true)
        }
    })
}


document.addEventListener("DOMContentLoaded", () => {

// Пятая страница - Будут ли рекомендации (Выбор одного)
$("#section-prepare-conclusion button").on("click tap", (event) => {
    $("#section-prepare-conclusion button").removeClass("active")
    $("#" + event.currentTarget.id).addClass("active")

    // Включаем кнопку далее
    $("#button-next").removeAttr("disabled")
})


// Шестая страница - тип обучения (выбор нескольких)
$("#section-training-options button").on("click tap", (event) => {
    $("#" + event.currentTarget.id).toggleClass("active")

    // Включаем кнопку далее если выбран хотя бы один
    if ($("#section-training-options button.active").length) {
        $("#button-next").removeAttr("disabled")
    } else {
        $("#button-next").attr("disabled", true)
    }
})


// Седьмая страница - города для обучения

// Открытие панели у конкретного инпута
$(".city-input__wrapper").on("click tap", (event) => {
    $(`#${event.currentTarget.id}`).append(`
        <div class="city-input__additional">
            <p class="city-input__additional-example">Москва</p>
            <p class="city-input__additional-example">Санкт-Петербург</p>
            <p class="city-input__additional-example">Казань</p>
            <p class="city-input__additional-example">Екатеринбург</p>
            <p class="city-input__additional-example">Новосибирск</p>
            <p class="city-input__additional-example">Красноярск</p>
            <p>или введите другой город</p>
        </div>
    `)

    $(".city-input__additional-example").unbind("click tap")
    $(".city-input__additional-example").on("click tap", (eventInput) => {
        // Находим родителя списка и получаем его id и по нему вставляем в инпут
        $("#city-input-" + event.currentTarget.id.split("-")[2]).val($(eventInput.target).text())
        cities[event.currentTarget.id.split("-")[2] - 1] = $(eventInput.target).text()
        updateCityInputs()
        $(`#${event.currentTarget.id} .city-input__additional`).remove()
    })

    // Клик вне этого блока закрывает выбор городов
    // $(document).unbind("click tap")
    $(document).on("click tap", (eventDoc) => {
        if (!$(eventDoc.target).closest("#" + event.currentTarget.id).length) {
            $(`#${event.currentTarget.id} .city-input__additional`).remove()
        }
    })
})

$(".city-input").on("change", (event) => {
    cities[event.currentTarget.id.split("-")[2] - 1] = event.currentTarget.value
    updateCityInputs()
})

});


function updateCityInputs() {
    // Прячем все контейнеры
    $(".city-input").val("");
    $(".city-input__wrapper").addClass("hidden")

    // Включаем все контейнеры в которых есть значение
    for (let city in cities) {
        $("#city-input-" + (parseInt(city) + 1)).val(cities[city]);
        $("#city-input__wrapper-" + (parseInt(city) + 1)).removeClass("hidden")
    }

    // Ставим всем контейнерам минус
    $(".city-input__wrapper-svg svg").replaceWith(`
        <svg class="city-input__delete" xmlns="http://www.w3.org/2000/svg" width="48" height="47" viewBox="0 0 48 47" fill="none">
            <path d="M32 23L16 23" stroke="#BD92CE" stroke-width="2" stroke-linecap="round"/>
        </svg>
    `)
    
    if (cities.length !== 5) {
        // Ставим последнему контейнеру плюсик если в нем есть значение, иначе ставим выпадающий список
        if ($(`#city-input-${cities.length}`).val()) {
            $(`#city-input__wrapper-${cities.length} .city-input__wrapper-svg svg`).replaceWith(`
                <svg class="city-input__add" xmlns="http://www.w3.org/2000/svg" width="48" height="47" viewBox="0 0 48 47" fill="none">
                    <path d="M24 15V31M32 23L16 23" stroke="#BD92CE" stroke-width="2" stroke-linecap="round"/>
                </svg>
            `)
        } else {
            $(`#city-input__wrapper-${cities.length} .city-input__wrapper-svg svg`).replaceWith(`
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="47" viewBox="0 0 48 47" fill="none">
                    <path d="M16.2411 19.2459C16.5333 18.9478 16.9905 18.9207 17.3127 19.1646L17.405 19.2459L24 25.9734L30.595 19.2459C30.8872 18.9478 31.3444 18.9207 31.6666 19.1646L31.7589 19.2459C32.0511 19.544 32.0777 20.0104 31.8386 20.339L31.7589 20.4332L24.582 27.7541C24.2898 28.0522 23.8325 28.0793 23.5103 27.8354L23.418 27.7541L16.2411 20.4332C15.9196 20.1053 15.9196 19.5738 16.2411 19.2459Z" fill="#BD92CE"/>
                </svg>
            `)
        }

        // Так же проверяем состояние у следующего
        if ($(`#city-input-${cities.length + 1}`).val()) {
            $(`#city-input__wrapper-${cities.length + 1} .city-input__wrapper-svg svg`).replaceWith(`
                <svg class="city-input__add" xmlns="http://www.w3.org/2000/svg" width="48" height="47" viewBox="0 0 48 47" fill="none">
                    <path d="M24 15V31M32 23L16 23" stroke="#BD92CE" stroke-width="2" stroke-linecap="round"/>
                </svg>
            `)
        } else {
            $(`#city-input__wrapper-${cities.length + 1} .city-input__wrapper-svg svg`).replaceWith(`
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="47" viewBox="0 0 48 47" fill="none">
                    <path d="M16.2411 19.2459C16.5333 18.9478 16.9905 18.9207 17.3127 19.1646L17.405 19.2459L24 25.9734L30.595 19.2459C30.8872 18.9478 31.3444 18.9207 31.6666 19.1646L31.7589 19.2459C32.0511 19.544 32.0777 20.0104 31.8386 20.339L31.7589 20.4332L24.582 27.7541C24.2898 28.0522 23.8325 28.0793 23.5103 27.8354L23.418 27.7541L16.2411 20.4332C15.9196 20.1053 15.9196 19.5738 16.2411 19.2459Z" fill="#BD92CE"/>
                </svg>
            `)
        }
    }
    

    // Добавить поле
    $(".city-input__add").unbind("click tap")
    $(".city-input__add").on("click tap", (event) => {
        event.stopPropagation()
        // Включаем контейнер идущий за последним активным
        $("#city-input__wrapper-" + (cities.length + 1)).removeClass("hidden")
    })

    // Удалить поле
    $(".city-input__delete").unbind("click tap")
    $(".city-input__delete").on("click tap", (event) => {
        event.stopPropagation()
        // Включаем контейнер идущий за последним активным
        cities.splice(parseInt($(event.target).closest(".city-input__wrapper").attr("id").split("-")[2]) - 1, 1)
        updateCityInputs()
    })


    // Включаем кнопку если есть хотя бы один город
    if (cities[0]) {
        $("#button-next").removeAttr("disabled")
    } else {
        $("#button-next").attr("disabled", true)
    }
}

document.addEventListener("DOMContentLoaded", () => {

// Восьмая страница - платные формы (Выбор одного)
$("#section-paid-forms button").on("click tap", (event) => {
    $("#section-paid-forms button").removeClass("active")
    $("#" + event.currentTarget.id).addClass("active")

    // Включаем кнопку далее
    $("#button-next").removeAttr("disabled")
})


// Девятая страница - институты для обучения
// Устанавливаем демо текст
$(".textarea-wrapper.demo textarea").val(demoText);

// При изменении проверяем включать ли кнопку
$(".institutions-wrapper .content").on("change", "textarea", () => {
    // Если текст не демо и не пустой, то разблокируем кнопку
    $("#button-next").attr("disabled", true)

    $(".textarea-wrapper:not(.demo)").each((index, element) => {
        if ($(element).find("textarea").val().trim()) {
            $("#button-next").removeAttr("disabled")
        }
    })
})

// Кнопка добавления института
$(".institutions-wrapper .content").on("click tap", ".institute__add", (event) => {
    // При нажатии заменяем ее на удаление
    $(event.currentTarget).replaceWith(`
        <svg class="institute__delete" xmlns="http://www.w3.org/2000/svg" width="48" height="47" viewBox="0 0 48 47" fill="none">
            <path d="M32 23L16 23" stroke="#BD92CE" stroke-width="2" stroke-linecap="round"/>
        </svg>
    `)
    
    // Если элементов 10 - то не добавляем
    if ($(".textarea-wrapper").length !== 10) {
        $(".institutions-wrapper .content").append(`
            <div class="textarea-wrapper">
                <h3>${++$(".textarea-wrapper").length}.</h3>
                <textarea maxlength="2000"></textarea>
                ${$(".textarea-wrapper").length !== 9
                    ? `<svg class="institute__add" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" fill="none">
                        <path d="M24 16V32M32 24L16 24" stroke="#BD92CE" stroke-width="2" stroke-linecap="round"/>
                    </svg>`
                    : `<svg class="institute__delete" xmlns="http://www.w3.org/2000/svg" width="48" height="47" viewBox="0 0 48 47" fill="none">
                        <path d="M32 23L16 23" stroke="#BD92CE" stroke-width="2" stroke-linecap="round"/>
                    </svg>`
                }
            </div>
        `)
    }

    $(".textarea-wrapper").last()["0"].scrollIntoView({ block: "center", behavior: "smooth" });
})

// Кнопка удаления института
$(".institutions-wrapper .content").on("click tap", ".institute__delete", (event) => {
    // Удаляем контейнер по которому нажали
    $(event.currentTarget).closest(".textarea-wrapper").remove()

    // Меняем цифру у всех текстареа
    $(".textarea-wrapper").each((index, element) => {
        $(element).find("h3").text(++index + ".")
    })

    // Ставим последнему элементу плюсик
    $(".textarea-wrapper").last().find("svg").replaceWith(`
        <svg class="institute__add" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" fill="none">
            <path d="M24 16V32M32 24L16 24" stroke="#BD92CE" stroke-width="2" stroke-linecap="round"/>
        </svg>
    `)
})

});


function renderPDF() {
    $("#pdf-form-client").text($("#form-client").val()) // ФИО Клиента
    $("#pdf-form-expert").text($("#form-expert").val()) // ФИО Эксперта

    const formDate = new Date($("#form-date").val())
    const months = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"]
    
    $("#pdf-form-date").text(`${months[formDate.getMonth()]} ${formDate.getFullYear()} года`) // Дата

    const activeVectors = vectors.filter(vector => vector.active)

    // Выбранные вектора
    $("#pdf-vectors").empty()
    for (let vector of activeVectors) {
        $("#pdf-vectors").append(`<p class="pdf-padding-small">• ${vector.title}</p>`)
    }

    // Лучший вектор
    $("#pdf-best-vector").text("• " + vectors.filter(vector => vector.best)[0].title)

    // Профессии
    $("#pdf-jobs").empty()
    for (let vector in activeVectors) {
        $("#pdf-jobs").append(`
            <div class="pdf-page" id="pdf-vector-jobs-${vector}">
                <p class="pdf-padding-medium">• ${activeVectors[vector].title}</p>
                <p class="pdf-padding-small">Профессии внутри данного вектора, которые рекомендованы участнику программы:</p>
            </div>
        `)

        for (let job of activeVectors[vector].jobs.filter(job => job.active)) {
            if (job.title) {
                $("#pdf-vector-jobs-" + vector).append(`<p class="pdf-padding-small pdf-job">${job.title}: ${job.desc}</p>`)
            } else {
                $("#pdf-vector-jobs-" + vector).append(`<p class="pdf-padding-small pdf-job">${job.input}</p>`)
            }
        }
    }

    // Формы обучения
    $("#pdf-training-options").empty()
    for (let option of $("#section-training-options button.active p")) {
        $("#pdf-training-options").append(`<p class="pdf-padding-small">${$(option).text()}</p>`)
    }

    // Города для обучения
    $("#pdf-city").empty()
    for (let city of $(".city-input")) {
        if ($(city).val()) { // Если не пустой
            $("#pdf-city").append(`<p class="pdf-padding-small pdf-break-text">${$(city).val()}</p>`)
        }
    }

    // Платная форма
    $("#pdf-paid-forms").text($("#section-paid-forms button.active p").text())

    // Институты
    $("#pdf-institutions").empty()
    for (let institute of $("#section-institutions .textarea-wrapper:not(.demo) textarea")) {
        if ($(institute).val()) { // Если не пустой
            $("#pdf-institutions").append(`<p class="pdf-padding-small pdf-break-text pdf-institute">${$(institute).val()}</p>`)
        }
    }

    // Комментарий (Если пустой, то скрываем)
    $("#pdf-comment").empty()
    if ($(".comment-wrapper textarea").val()) {
        $("#pdf-comment").text($(".comment-wrapper textarea").val());

        $("#pdf-comment-title").removeClass("hidden")
        $("#pdf-comment").removeClass("hidden")
    } else {
        $("#pdf-comment-title").addClass("hidden")
        $("#pdf-comment").addClass("hidden")
    }


    // Если выбрали не давать рекомендации
    if ($("#prepare-conclusion-no").hasClass("active")) {
        $(".pdf-extra").addClass("hidden")
    } else {
        $(".pdf-extra").removeClass("hidden")
    }
}