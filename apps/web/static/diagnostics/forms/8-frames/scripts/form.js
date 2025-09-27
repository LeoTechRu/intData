// Если пользователь валидно заполнил форму и данные сохранились в хэш, то заполняем поля
let hashUserFormData = JSON.parse(localStorage.getItem("userFormData"))
if (hashUserFormData) {
    $("#form-name").val(hashUserFormData.formName)
    $("#form-phone").val(hashUserFormData.formPhone)
    $("#form-email").val(hashUserFormData.formEmail)

    if (hashUserFormData.formPhoneParents) {
        $("#parents-phone").addClass("checked")
    }

    // Активируем галочку
    $("#policy").addClass("checked")
}

$("#form-name").change(() => { // Удаление лишних пробелов
    $("#form-name").val($("#form-name").val().replace(/ +/g, ' ').trim())
})

$("#form-phone").change(() => { // Удаление пробелов
    $("#form-phone").val($("#form-phone").val().replace(/ /g,''))
})

$("#form-email").change(() => { // Удаление пробелов
    $("#form-email").val($("#form-email").val().replace(/ /g,''))
})


// Галочка Телефон родителей
$("#parents-phone").on("click tap", () => {
    $("#parents-phone").toggleClass("checked")
})

// Клик тексту после галочки
$("#label-parents-phone").on("click tap", () => {
    $("#parents-phone").addClass("checked")
})


// Галочка Пользовательское соглашение
$("#policy").on("click tap", () => {
    $("#policy").toggleClass("checked")
})

// Клик тексту после галочки
$("#label-policy").on("click tap", () => {
    $("#policy").addClass("checked")
})

// Клик по политике
$("#label-policy span").on("click tap", () => {
    window.open(POLICY_URL, "_blank")
})


// Ивент submit у формы входа
const form = document.querySelector('form')
form.addEventListener('submit', (event) => {
    // Отключение базового перехода
    event.preventDefault()

    // Отключаем кнопку на 2 секунды
    $("#submit-form").attr("disabled", "disabled")
    setTimeout(() => {
        $("#submit-form").removeAttr("disabled")
    }, 2000)


    // Получаем поля из фомы
    const formData = new FormData(form)
    const formName = formData.get("form-name")
    const formPhone = formData.get("form-phone")
    const formEmail = formData.get("form-email")
    
    // В поле ФИО должно быть ровно 3 слова
    if (formName.split(" ").length !== 3) {
        inputError("#form-name")

        // Ставим текст ошибки
        $("#form-error").text("Неверный формат ФИО")
        $("#form-error").addClass("show")
        setTimeout(() => {
            $("#form-error").removeClass("show")
        }, 2000)
        return
    }

    // Проверка поля Телефона на регулярном выражении
    let rePhone = /^[\d\+][\d\(\)\ -]{9,14}\d$/
    if (!rePhone.test(formPhone)) {
        inputError("#form-phone")
        // Ставим текст ошибки
        $("#form-error").text("Неверный номер телефона")
        $("#form-error").addClass("show")
        setTimeout(() => {
            $("#form-error").removeClass("show")
        }, 2000)
        return
    }

    // Проверка поля Почты на регулярном выражении
    let reEmail = /^[\w-\.]+@[\w-]+\.[a-z]{2,4}$/i
    if (!reEmail.test(formEmail)) {
        inputError("#form-email")
        // Ставим текст ошибки
        $("#form-error").text("Неверный email")
        $("#form-error").addClass("show")
        setTimeout(() => {
            $("#form-error").removeClass("show")
        }, 2000)
        return
    }

    if (!$("#policy").hasClass("checked")) {
        // Ставим текст ошибки
        $("#form-error").text("Отметьте поле")
        $("#form-error").addClass("show")
        setTimeout(() => {
            $("#form-error").removeClass("show")
        }, 2000)
        return
    }


    $("#form-aside").addClass("hidden")
    $("#form-section").addClass("hidden")
    $("#section-title").removeClass("hidden")
    $("#section-content").removeClass("hidden")

    // Класс для корректного отображения
    $("article").addClass("article-content")

    // Если чекбокс существует, берем его значение, иначе значение из памяти
    let isPhoneParents
    if ($("#parents-phone").length) {
        isPhoneParents = $("#parents-phone").hasClass("checked")
    } else if (hashUserFormData) {
        isPhoneParents = hashUserFormData.formPhoneParents
    } else {
        isPhoneParents = false
    }

    // Сохраняем информацию в хэш
    let userFormData = {
        formName: formName,
        formPhone: formPhone,
        formPhoneParents: isPhoneParents,
        formEmail: formEmail,
    }

    localStorage.setItem("userFormData", JSON.stringify(userFormData))

    // Когда заполнили все поля и нажали "Далее", то рендерит Правила
})