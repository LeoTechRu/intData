// Скрипт для автозаполнения заключения
// Отключать его в index.html перед деплоем

function auto() {
    $("#form-client").val("Фамилия Имя Отчество1111");
    $("#form-expert").val("Фамилия Имя Отчество2222");
    $("#button-next").click();

    $("#vector-7").click();
    $("#vector-11").click();
    $("#vector-9").click();
    $("#vector-8").click();


    $("#button-next").click();
    $("#vector-best-11").click();
    $("#button-next").click();

    $("#vector-7-job-0").click();
    $("#vector-11-job-0").click();
    $("#vector-9-job-0").click();
    $("#vector-8-job-0").click();


    $("#button-next").click();
    $("#prepare-conclusion-yes").click();
    $("#button-next").click();

    $("#training-options-1").click();
    $("#training-options-2").click();
    $("#training-options-3").click();
    $("#training-options-4").click();

    $("#button-next").click();
    $("#city-input-1").val("Москва");
    $("#city-input-2").val("Санкт-Петербург");
    $("#city-input-3").val("Казань");
    $("#city-input-4").val("Екатеринбург");
    $("#city-input-5").val("Красноярск");

    $("#button-next").click();
    $("#paid-forms-1").click();
    $("#button-next").click();
    
    $(".textarea-wrapper textarea").val(`Мы рекомендуем в каждом поле давать следующее описание варианта обучения:
1. Название места (ВУЗ, колледж, онлайн - университет и прочее)
2. Название программы обучения.
3. Ссылка на сайт, где можно почитать подробности.

Пример описания, которое добавляем в поле ниже:
НИУ ВШЭ, программа «Реклама и связи с общественностью» в НИУ ВШЭ (5 место в рейтинге). Сайт: https://www.hse.ru/ba/ad/admission/`);

    $(".institute__add").click();
    $(".textarea-wrapper textarea").last().val(`Вторая рекомендация:
1. Название места (ВУЗ, колледж, онлайн - университет и прочее)
2. Название программы обучения.
3. Ссылка на сайт, где можно почитать подробности.

Пример описания, которое добавляем в поле ниже:
НИУ ВШЭ, программа «Реклама и связи с общественностью» в НИУ ВШЭ (5 место в рейтинге). Сайт: https://www.hse.ru/ba/ad/admission/`);

    $("#button-next").click();
    $(".comment-wrapper textarea").val(`Длинный комментарий
Lorem Ipsum is simply dummy text of the printing and typesetting industry.

Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book.

It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum.`);
    $("#button-next").click();
}

auto()