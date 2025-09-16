// Детская версия
// Перекидываем на конец теста если есть значение
if (localStorage.getItem("test-end")) {
    location.href = "testing-end.html?test-name=myNeedsKid"
}


// Если нету manager-id В ссылке то перекинет на страницу с просьбой получить актуальную ссылку
let URLParams = Object.fromEntries(new URLSearchParams(window.location.search))
// Если в строке нету значения manager-id или он не цифра или значение пустое
if (!URLParams.hasOwnProperty("manager-id") || isNaN(URLParams["manager-id"]) || URLParams["manager-id"] === "") {
    location.href = "testing-end.html?no-manager-id"
}

// Получем сохраненные данные о тестировании
let questionsHash = JSON.parse(localStorage.getItem("questionsHash_myNeedsKid"))
let isQuestionsHash = questionsHash ? true : false // Была ли информация взята из кэша

// Если информации есть - то записываем
if (isQuestionsHash) {
    questions = questionsHash
}