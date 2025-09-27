import { vectors } from "./vectors.js"
import { logo, titleLogo, figureLogo, lastPage, lastPageLogo } from "./images.js"

// Разбиение текста на текст и ссылки
function splitTextByLinks(text) {
    const regex = /(https?:\/\/[^\s]+)/g; // Регулярное выражение для поиска ссылок
  
    // Делим текст
    const parts = text.split(regex);
  
    // Преобразуем части текста: ссылки заменяем на объекты
    const result = parts.map(part => {
        if (part.match(regex)) {
            return { text: part, link: part, style: "link" }; // Если это ссылка, то возвращаем объект
        }
        return part; // Если это обычный текст, возвращаем как есть
    })
  
    return result;
}

// Что бы все точно работало
document.addEventListener("DOMContentLoaded", () => {

$("#button-download").on("click tap", () => {
    $(".pdf-status").text("Загрузка документа")
    setTimeout(() => {
        $(".pdf-status").text("")
    }, 10000)

    const wMargin = 60 // Боковые отступы

    const formDate = new Date($("#form-date").val())
    const months = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"]

    const activeVectors = vectors.filter(vector => vector.active)

    // Список выбранных векторов
    let selectedVectors = []
    for (let vector of activeVectors) {
        selectedVectors.push({
            text: vector.title,
            margin: [wMargin, 10, wMargin, 0],
        })
    }

    // Лучший вектор
    let selectedBestVector = {
        text: "• " + vectors.filter(vector => vector.best)[0].title,
        margin: [wMargin, 0]
    }

    let selectedJobs = []

    // Профессии
    for (let vector of activeVectors) {
        selectedJobs.push(
            {
                text: vector.title,
                alignment: "left",
                margin: [wMargin, 20, wMargin, 0]
            },
            {
                text: "Профессии внутри данного вектора, которые рекомендованы участнику программы:",
                margin: [wMargin, 10, wMargin, 0]
            },
        )

        for (let job of vector.jobs.filter(job => job.active)) {
            if (job.title) {
                selectedJobs.push({
                    text: `${job.title}: ${job.desc}`,
                    alignment: "left",
                    margin: [wMargin, 10, wMargin, 0]
                })
            } else {
                selectedJobs.push({
                    text: job.input,
                    alignment: "left",
                    margin: [wMargin, 10, wMargin, 0]
                })
            }
        }
    }


    // Рекомендации + комментарий если он есть
    let recommendations = []

    if ($("#prepare-conclusion-yes").hasClass("active")) {
        recommendations.push(
            {
                text: "3. Рекомендации по образовательным траекториям",
                style: "boldCyan",
                margin: [wMargin, 20, wMargin, 0]
            },
            {
                text: "При подборе образовательных траекторий учтены пожелания и ограничения участника программы по поступлению и обучению, которые обсуждались на этапе записи на программу.",
                margin: [wMargin, 10, wMargin, 0]
            },
            {
                text: "При подборе вариантов обучения также учитывались рейтинги и репутация учебных заведений согласно общедоступным рейтингам учебных программ и учебных заведений. И актуальной аналитике рынка образовательных услуг.",
                margin: [wMargin, 10, wMargin, 0]
            },
            {
                text: "С учетом пожеланий участника программы при подборе вариантов обучения были выделены следующие критерии отбора:",
                margin: [wMargin, 10, wMargin, 0]
            },
            {
                text: "1. Форма обучения:",
                style: "bold",
                margin: [wMargin, 20, wMargin, 0]
            }
        )

        // Формы обучения
        for (let option of $("#section-training-options button.active p")) {
            recommendations.push(
                {
                    text: $(option).text(),
                    margin: [wMargin, 10, wMargin, 0]
                }
            )
        }

        // Города для обучения
        recommendations.push({
            text: "2. Города для получения образования  (при обучении в очном оффлайн формате):",
            style: "bold",
            margin: [wMargin, 20, wMargin, 0]
        })
        for (let city of $(".city-input")) {
            if ($(city).val()) { // Если не пустой
                recommendations.push(
                    {
                        text: $(city).val(),
                        margin: [wMargin, 10, wMargin, 0]
                    }
                )
            }
        }


        // Платная форма
        recommendations.push(
            {
                text: "3. Платные формы обучения:",
                style: "bold",
                margin: [wMargin, 20, wMargin, 0]
            },
            {
                text: $("#section-paid-forms button.active p").text(),
                margin: [wMargin, 10, wMargin, 0]
            }
        )

        
        // Институты
        recommendations.push({
            text: "4. Рекомендованные варианты обучения для получения выбранных профессий:",
            style: "boldCyan",
            margin: [wMargin, 20, wMargin, 0]
        })

        for (let institute of $("#section-institutions .textarea-wrapper:not(.demo) textarea")) {
            if ($(institute).val()) { // Если не пустой
                recommendations.push(
                    {
                        text: splitTextByLinks($(institute).val()),
                        margin: [wMargin, 10, wMargin, 10]
                    }
                )
            }
        }
    }


    // Комментарий (По выбору)
    if ($(".comment-wrapper textarea").val()) {
        recommendations.push([
            {
                text: "Дополнительные комментарии:",
                style: "bold",
                margin: [wMargin, 20, wMargin, 0]
            },
            {
                text: splitTextByLinks($(".comment-wrapper textarea").val()),
                margin: [wMargin, 10, wMargin, 0]
            }
        ])
    }
    

    // Формирование документа
    let docDefinition = {
        pageSize: "A4",
        pageOrientation: "portrait",
        pageMargins: [0, 40, 0, 40],
        content: [
            // Первая страница
            {
                image: logo,
                width: 240,
                margin: [0, 48, 0, 0],
            },

            {
                image: titleLogo,
                width: 420,
                alignment: "right",
                margin: [0, 144, 0, 0],
            },
            {
                image: figureLogo,
                width: 90,
                alignment: "right",
                margin: [0, 120, 20, 0],
                pageBreak: "after"
            },


            // Форма с данными
            {
                text: [
                    "Данное заключение является дополнением к консультации по итогам программы, на которой подробно обсуждаются наши выводы и рекомендации.",
                    "\nПолные развернутые рекомендации обсуждаются именно на личной встрече с вашим консультантом. Этот документ содержит резюме к итоговой консультации и основные выводы."
                ],
                // Большой отступ с верху
                margin: [wMargin, 0, wMargin, 0]
            },
            {
                text: "Участник программы:",
                style: "bold",
                margin: [wMargin, 20, wMargin, 0]
            },
            {
                text: $("#form-client").val(),
                margin: [wMargin, 10, wMargin, 0]
            },
            {
                text: "Эксперт программы:",
                style: "bold",
                margin: [wMargin, 20, wMargin, 0]
            },
            {
                text: $("#form-expert").val(),
                margin: [wMargin, 10, wMargin, 0]
            },
            {
                text: "Дата выдачи рекомендаций*:",
                style: "bold",
                margin: [wMargin, 20, wMargin, 0]
            },
            {
                text: `${months[formDate.getMonth()]} ${formDate.getFullYear()} года`,
                margin: [wMargin, 10, wMargin, 0]
            },
            {
                text: [
                    "*Обращаем ваше внимание, что рекомендации по вариантам поступления могут стать неактуальными в течение года, так как учебные заведения могут менять требования к поступающим, вступительные испытания и содержание учебных программ.",
                    "\nМы рекомендуем следить за актуальными новостями выбранных вами учебных заведений и уточнять информацию на момент поступления."
                ],
                style: "italics",
                margin: [wMargin, 20, wMargin, 0],
                pageBreak: "after"
            },


            // Вектора
            {
                text: "1. Рекомендации по профессиональным векторам",
                style: "boldCyan",
                margin: [wMargin, 0, wMargin, 0]
            },
            {
                text: "По итогам прохождения программы  «Выбор профессии 3.0» Международной школы выбора профессии Пункт Б были выявлены следующие профессиональные вектора, наиболее подходящие участнику программы для профессиональной реализации:",
                margin: [wMargin, 10, wMargin, 10]
            },
            // Список выбранных векторов
            ...selectedVectors,
            {
                text: "Именно в указанных профессиональных сферах с наибольшей вероятностью участник программы сможет реализовать свои интересы, склонности и потребности. Которые были выявлены в процессе прохождения диагностик (тестов, диагностических игр и других заданий программы).",
                style: "bold",
                margin: [wMargin, 20, wMargin, 0]
            },
            {
                text: "При подборе профессиональных сфер мы также ориентировались на востребованность профессий и профессиональные перспективы в выбранных сферах. Одним из важных условий подбора профессиональных векторов и профессий в рамках программы «Выбор профессии 3.0» является их актуальность (востребованность на рынке труда).",
                margin: [wMargin, 10, wMargin, 0]
            },     
            {
                text: "Мы учитывали не только соответствие сферы особенностям участника программы, но и ее востребованность (как в настоящий момент, так и в перспективе). Так как одним из важных факторов удовлетворенности профессией является достойный уровень оплаты труда и возможность найти хорошую работу. Этот фактор также учитывался при подготовке рекомендаций.",
                margin: [wMargin, 10, wMargin, 0]
            },       
            {
                text: "При этом диагностики программы показывают, что в наибольшей степени интересам, потребностям и пожеланиям к профессии участника программы соответствует:",
                margin: [wMargin, 10, wMargin, 20]
            }, 
            // Лучший вектор
            selectedBestVector,
            {
                text: "И именно этот профессиональный вектор мы рекомендуем рассмотреть как основной вариант для профессиональной реализации участника программы.",
                margin: [wMargin, 20, wMargin, 0],
                pageBreak: "after"
            },


            // Критерии
            {
                text: "2. Рекомендации по профессиям внутри выбранных профессиональных векторов",
                style: "boldCyan",
                margin: [wMargin, 0 , wMargin, 0]
            },
            {
                text: "При подборе конкретных профессий для участника программы внутри выбранных профессиональных векторов мы ориентировались на три критерия:",
                margin: [wMargin, 10, wMargin, 0]
            },
            {
                text: "• Критерий 1",
                style: "boldCyan",
                margin: [wMargin, 20, wMargin, 0]
            },
            {
                text: "Профессия соответствует интересам участника программы или с большой вероятностью может его заинтересовать (так как у него есть похожие интересы и в этой профессии надо делать то, что уже сейчас нравится делать участнику программы).",
                margin: [wMargin, 10, wMargin, 0]
            },
            {
                text: "• Критерий 2",
                style: "boldCyan",
                margin: [wMargin, 20, wMargin, 0]
            },
            {
                text: `Профессия "доступна" для участника программы (доступны хорошие программы обучения данной профессии, он действительно может на них поступить, выучиться и освоить на хорошем уровне мастерства). При этом мы ориентировались в первую очередь на озвученные на этапе записи на программу пожелания и ограничения участника по вариантам обучения (и поступления).`,
                margin: [wMargin, 10, wMargin, 0]
            },
            {
                text: "• Критерий 3",
                style: "boldCyan",
                margin: [wMargin, 20, wMargin, 0]
            },
            {
                text: "Выбранные профессии являются востребованными на рынке труда. И на сегодняшний день и в перспективе в этих профессиях есть спрос на хороших специалистов, наблюдается нехватка квалифицированных кадров, и работодатели подтверждают, что профессионалы из этих сфер нужны и востребованы*.",
                margin: [wMargin, 10, wMargin, 0]
            },
            {
                text: `*Здесь мы считаем важным сделать комментарий про "востребованность профессий". Важно помнить, что востребованы всегда в первую очередь специалисты, а не профессии. Поэтому важным условием успешной профессиональной реализации в любой профессии является готовность учиться и развиваться в ней. Пожалуйста, не воспринимайте рекомендуемые нами профессии как 100% гарантию трудоустройства. Многое в этом вопросе зависит и от вас. Прежде всего от вашего трудолюбия и готовности учиться. Не только от выбора "востребованной профессии".`,
                style: "italics",
                margin: [wMargin, 20, wMargin, 0]
            },
            {
                text: `Таким образом, по итогам прохождения программы "Выбор профессии 3.0" мы рекомендуем следующие профессии внутри выбранных профессиональных векторов (для вашего удобства мы также приводим краткое, простое и понятное описание рекомендованных профессий):`,
                margin: [wMargin, 20, wMargin, 0]
            },
            // Выбранные профессии
            ...selectedJobs,


            // Рекомендации (По выбору) + Комментарий (По выбору)
            ...recommendations,


            // Последняя страница
            {
                image: lastPage,
                width: 350,
                alignment: "center",
                margin: [0, 60, 0, 0],
                pageBreak: "before"
                
            },
            {
                image: lastPageLogo,
                width: 130,
                alignment: "right",
                margin: [0, 20, 70, 0],
            },
        ],
        styles: {
            bold: {
                bold: true
            },
            italics: {
                italics: true,
            },
            boldCyan: {
                color: "#66CAA5",
                bold: true,
                alignment: "left",
            },
            link: {
                color: "#3366BB",
                alignment: "left",
            }
        },
        defaultStyle: {
            fontSize: 14,
            alignment: "justify",
        }
    }

    pdfMake.createPdf(docDefinition).download(
        `Заключение ${$("#form-client").val()} ${moment().format("DD-MM-YYYY")}`
    );
})

});