// Первая буква заглавная
function FirstUpperCase(str) {
    // Если есть хотябы один символ
    if (str.length !== 0) {
        return str[0].toUpperCase() + str.slice(1);
    }

    // Иначе пустая строка
    return ""
}

for (let job of jobs) {
    $(".content").append(`
        <h3>${FirstUpperCase(job.title1)}</h3>
        <p>${FirstUpperCase(job.description1)}</p>
        <h3>${FirstUpperCase(job.title2)}</h3>
        <p>${FirstUpperCase(job.description2)}</p>
    `)
}