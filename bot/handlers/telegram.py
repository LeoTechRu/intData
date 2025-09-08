# /sd/intdata/bot/handlers/telegram.py
import re

from aiogram import Router, F
from aiogram.filters import Command
from aiogram.types import Message
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from datetime import datetime, date
from typing import Callable
from decorators import role_required, group_required
from core.models import GroupType, LogLevel, UserRole
from core.services.telegram_user_service import TelegramUserService

# ==============================
# РОУТЕРЫ
# ==============================
router = Router()
user_router = Router()
group_router = Router()

# -----------------------------
# Универсальные функции
# -----------------------------

async def process_data_input(
    message: Message,
    state: FSMContext,
    validation_func: Callable,
    update_method: Callable,
    success_msg: str,
    error_msg: str
):
    """Универсальный обработчик ввода данных через FSM"""
    data = message.text.strip()
    if not validation_func(data):
        await message.answer(error_msg)
        return

    async with TelegramUserService() as user_service:
        success = await update_method(user_service, message.from_user.id, data)

    if success:
        await message.answer(success_msg.format(data=data))
    else:
        await message.answer("Произошла ошибка при сохранении данных")
    await state.clear()

# -----------------------------
# Валидаторы
# -----------------------------

def validate_email(email: str) -> bool:
    return "@" in email and "." in email.split("@")[-1]

def validate_phone(phone: str) -> bool:
    return phone.startswith("+") and phone[1:].isdigit()

def validate_birthday(date_str: str) -> bool:
    try:
        datetime.strptime(date_str, "%d.%m.%Y")
        return True
    except ValueError:
        return False

def validate_group_description(desc: str) -> bool:
    return len(desc) <= 500

def validate_fullname(name: str) -> bool:
    return 0 < len(name) <= 255

# -----------------------------
# Состояния FSM
# -----------------------------

class UpdateDataStates(StatesGroup):
    waiting_for_birthday = State()
    waiting_for_email = State()
    waiting_for_fullname = State()
    waiting_for_phone = State()
    waiting_for_group_description = State()

# -----------------------------
# Команды
# -----------------------------
@router.message(Command("start"))
@user_router.message(F.text.lower().in_(["старт", "start", "привет", "hello"]))
async def cmd_start(message: Message):
    await message.answer(f"Привет, {message.from_user.first_name}! Добро пожаловать в бота.")


@user_router.message(Command("help"))
async def cmd_help(message: Message) -> None:
    help_text = (
        "Доступные команды:\n"
        "\n"
        "Общие:\n"
        "/start - приветственное сообщение.\n"
        "/help - эта справка.\n"
        "/cancel - отменить ввод.\n"
        "\n"
        "Профиль:\n"
        "/contact - показать контактные данные.\n"
        "/setfullname - установить отображаемое имя.\n"
        "/setemail - установить email.\n"
        "/setphone - установить телефон.\n"
        "/setbirthday - установить день рождения.\n"
        "/birthday - напоминание о дне рождения.\n"
        "\n"
        "Заметки:\n"
        "/note <текст> - создать заметку в Inbox (#proj:<id> для проекта).\n"
        "/assign <note_id> <proj|area|res> <id> - присвоить заметку контейнеру.\n"
        "\n"
        "Привычки:\n"
        "/habit_list - список привычек.\n"
        "/habit_add [название] [daily|weekly|monthly] - добавить привычку.\n"
        "/habit_done [id] - отметить выполнение за сегодня.\n"
        "\n"
        "Тайм-трекер:\n"
        "/time_start [описание] - запустить таймер.\n"
        "/time_stop [id] - остановить таймер.\n"
        "/time_list - последние записи времени.\n"
        "/time_resume <task_id> - возобновить таймер для задачи.\n"
        "\n"
        "Группы:\n"
        "/group - зарегистрировать группу и показать участников.\n"
        "/setgroupdesc - задать описание группы (в группах).\n"
        "\n"
        "Администрирование:\n"
        "/setloglevel <DEBUG|INFO|ERROR> - установить уровень логирования.\n"
        "/getloglevel - показать текущий уровень логов."
    )
    await message.answer(help_text)

@user_router.message(Command("cancel"))
@user_router.message(F.text.lower().in_(["cancel", "отмена", "выйти", "прервать"]))
async def cmd_cancel(message: Message, state: FSMContext):
    current_state = await state.get_state()
    if current_state:
        await state.clear()
        await message.answer(f"{message.from_user.first_name}, ввод отменен.")
    else:
        await message.answer(f"{message.from_user.first_name}, вы не находитесь в режиме ввода.")

@user_router.message(Command("birthday"))
@user_router.message(F.text.lower() == "день рождение")
async def cmd_birthday(message: Message, state: FSMContext):
    birthday = None
    async with TelegramUserService() as user_service:
        user_db = await user_service.get_user_by_telegram_id(message.from_user.id)
        birthday_raw = (
            user_db.bot_settings.get("birthday")
            if user_db and isinstance(user_db.bot_settings, dict)
            else None
        )
        if isinstance(birthday_raw, str):
            try:
                birthday = datetime.strptime(birthday_raw, "%d.%m.%Y").date()
            except ValueError:
                birthday = None
        elif isinstance(birthday_raw, date):
            birthday = birthday_raw

    if birthday:
        today = datetime.today().date()
        this_year_birthday = birthday.replace(year=today.year)
        if this_year_birthday < today:
            this_year_birthday = this_year_birthday.replace(year=today.year + 1)
        days_left = (this_year_birthday - today).days
        if days_left == 0:
            await message.answer(
                f"{message.from_user.first_name}, сегодня ваш день рождения! 🎉 ({birthday.strftime('%d.%m.%Y')})"
            )
        else:
            await message.answer(
                f"{message.from_user.first_name}, до дня рождения осталось {days_left} дней ({birthday.strftime('%d.%m.%Y')})"
            )
        return

    await message.answer(
        f"{message.from_user.first_name}, введите ваш день рождения в формате ДД.ММ.ГГГГ:"
    )
    await state.set_state(UpdateDataStates.waiting_for_birthday)

@user_router.message(Command("contact"))
@user_router.message(F.text.lower().in_(["контакт", "профиль"]))
async def cmd_contact(message: Message):
    async with TelegramUserService() as user_service:
        info = await user_service.get_contact_info(message.from_user.id)

    if not info:
        await message.answer(
            f"{message.from_user.first_name}, произошла ошибка при получении данных"
        )
        return

    name = (
        info.get("full_display_name")
        or f"{info.get('first_name') or ''} {info.get('last_name') or ''}".strip()
        or message.from_user.first_name
    )

    fields = {
        "Telegram ID": info["telegram_id"],
        "Username": info.get("username"),
        "Имя": name,
        "Email": info.get("email"),
        "Телефон": info.get("phone"),
        "День рождения": info.get("birthday"),
    }

    lines = [f"{name}, контактные данные:"]
    for label, value in fields.items():
        if value:
            lines.append(f"{label}: {value}")

    lines.append("")
    lines.append("Команды для обновления:")
    lines.append("/setfullname - установить отображаемое имя")
    lines.append("/setemail - установить email")
    lines.append("/setphone - установить телефон")
    lines.append("/setbirthday - установить день рождения")

    await message.answer("\n".join(lines))


@user_router.message(Command("setfullname"))
async def cmd_set_fullname(message: Message, state: FSMContext):
    await message.answer("Введите отображаемое имя:")
    await state.set_state(UpdateDataStates.waiting_for_fullname)


@user_router.message(UpdateDataStates.waiting_for_fullname)
async def process_fullname(message: Message, state: FSMContext):
    await process_data_input(
        message,
        state,
        validate_fullname,
        lambda svc, user_id, data: svc.update_bot_setting(user_id, "full_display_name", data),
        "Имя обновлено: {data}",
        "Имя не должно быть пустым и длиннее 255 символов",
    )


@user_router.message(Command("setemail"))
async def cmd_set_email(message: Message, state: FSMContext):
    await message.answer("Введите email:")
    await state.set_state(UpdateDataStates.waiting_for_email)


@user_router.message(UpdateDataStates.waiting_for_email)
async def process_email(message: Message, state: FSMContext):
    await process_data_input(
        message,
        state,
        validate_email,
        lambda svc, user_id, data: svc.update_bot_setting(user_id, "email", data),
        "Email обновлён: {data}",
        "Некорректный email",
    )


@user_router.message(Command("setphone"))
async def cmd_set_phone(message: Message, state: FSMContext):
    await message.answer("Введите телефон в формате +1234567890:")
    await state.set_state(UpdateDataStates.waiting_for_phone)


@user_router.message(UpdateDataStates.waiting_for_phone)
async def process_phone(message: Message, state: FSMContext):
    await process_data_input(
        message,
        state,
        validate_phone,
        lambda svc, user_id, data: svc.update_bot_setting(user_id, "phone", data),
        "Телефон обновлён: {data}",
        "Некорректный номер телефона",
    )


@user_router.message(Command("setbirthday"))
async def cmd_set_birthday(message: Message, state: FSMContext):
    await message.answer("Введите ваш день рождения в формате ДД.ММ.ГГГГ:")
    await state.set_state(UpdateDataStates.waiting_for_birthday)


@user_router.message(UpdateDataStates.waiting_for_birthday)
async def process_birthday_input(message: Message, state: FSMContext):
    await process_data_input(
        message,
        state,
        validate_birthday,
        lambda svc, user_id, data: svc.update_bot_setting(user_id, "birthday", data),
        "День рождения сохранён: {data}",
        "Некорректная дата. Используйте формат ДД.ММ.ГГГГ",
    )

# -----------------------------
# Группы
# -----------------------------

@group_router.message(Command("group"))
@group_router.message(F.text.lower().in_(["группа", "group"]))
async def cmd_group(message: Message):
    async with TelegramUserService() as user_service:
        chat = message.chat
        chat_title = chat.title or f"{message.from_user.first_name} группа"
        group = await user_service.get_group_by_telegram_id(chat.id)
        if not group:
            group = await user_service.create_group(
                telegram_id=chat.id,
                title=chat.title or chat_title,
                type=GroupType(chat.type.lower()),
                owner_id=message.from_user.id
            )
            await message.answer(f"Группа '{chat_title}' добавлена в БД. Вы — её создатель.")
            return
        is_member = await user_service.is_user_in_group(message.from_user.id, chat.id)
        if not is_member:
            success, response = await user_service.add_user_to_group(message.from_user.id, chat.id)
            await message.answer(response if success else f"Ошибка: {response}")
            return
        members = await user_service.get_group_members(chat.id)
        if members:
            member_list = "\n".join(
                [
                    (
                        m.bot_settings.get("full_display_name")
                        if isinstance(m.bot_settings, dict)
                        and m.bot_settings.get("full_display_name")
                        else f"{m.first_name} {m.last_name or ''}".strip()
                    )
                    for m in members
                ]
            )
            await message.answer(
                f"Участники группы '{chat_title}':\n{member_list}"
            )
        else:
            await message.answer("Группа пока пуста.")


@group_router.message(Command("setgroupdesc"))
async def cmd_set_group_desc(message: Message, state: FSMContext):
    if message.chat.type not in {"group", "supergroup"}:
        await message.answer("Команда доступна только в группах")
        return
    async with TelegramUserService() as user_service:
        await user_service.get_or_create_group(
            message.chat.id,
            title=message.chat.title,
            type=GroupType(message.chat.type.lower()),
            owner_id=message.from_user.id,
        )
    await message.answer("Введите описание группы (до 500 символов):")
    await state.set_state(UpdateDataStates.waiting_for_group_description)


@group_router.message(UpdateDataStates.waiting_for_group_description)
async def process_group_desc(message: Message, state: FSMContext):
    if message.chat.type not in {"group", "supergroup"}:
        await message.answer("Команда доступна только в группах")
        await state.clear()
        return
    await process_data_input(
        message,
        state,
        validate_group_description,
        lambda svc, _uid, data: svc.update_group_description(message.chat.id, data),
        "Описание группы обновлено: {data}",
        "Описание должно быть не длиннее 500 символов",
    )

# -----------------------------
# Логирование
# -----------------------------

@user_router.message(Command("setloglevel"))
@role_required(UserRole.admin)  # Добавьте проверку прав администратора
async def cmd_set_log_level(message: Message):
    parts = message.text.split()
    if len(parts) < 2:
        await message.answer("Используйте: /setloglevel [level]")
        return
    level = parts[1].upper()
    if level not in ["DEBUG", "INFO", "ERROR"]:
        await message.answer("Недопустимый уровень: используйте DEBUG, INFO или ERROR")
        return
    async with TelegramUserService() as user_service:
        # ``LogLevel`` теперь основан на ``IntEnum``, поэтому преобразуем
        # строковое имя уровня через обращение по ключу.
        success = await user_service.update_log_level(
            LogLevel[level], chat_id=message.chat.id
        )
        if success:
            await message.answer(f"Уровень логирования установлен: {level}")
        else:
            await message.answer("Не удалось обновить настройки логирования")

@user_router.message(Command("getloglevel"))
async def cmd_get_log_level(message: Message):
    async with TelegramUserService() as user_service:
        log_settings = await user_service.get_log_settings()
        current_level = log_settings.level if log_settings else LogLevel.ERROR
        chat_id = log_settings.chat_id if log_settings else "не задан"
        await message.answer(f"Текущий уровень: {current_level}\nГруппа для логов: {chat_id}")

# Универсальный хендлер (ловит всё, что не подошло выше)
forward_map: dict[int, tuple[int, int]] = {}

@router.message()
async def unknown_message_handler(message: Message) -> None:
    async with TelegramUserService() as user_service:
        settings = await user_service.get_log_settings()
        log_chat_id = settings.chat_id if settings else None

    if not log_chat_id or message.chat.id == log_chat_id:
        return

    try:
        from core.db import bot

        meta_text = (
            f"||origin_chat_id:{message.chat.id}|origin_msg_id:{message.message_id}||"
        )
        fwd_msg = await message.forward(log_chat_id)
        forward_map[fwd_msg.message_id] = (message.chat.id, message.message_id)
        await bot.send_message(
            log_chat_id,
            meta_text,
            parse_mode=None,
            reply_to_message_id=fwd_msg.message_id,
        )
    except Exception as e:  # pragma: no cover - defensive
        print(f"Ошибка логирования: {e}")


@router.message()
async def handle_admin_reply(message: Message) -> None:
    async with TelegramUserService() as user_service:
        settings = await user_service.get_log_settings()
        log_chat_id = settings.chat_id if settings else None

    if not log_chat_id or message.chat.id != log_chat_id or not message.reply_to_message:
        return

    from core.db import bot
    from aiogram.exceptions import TelegramAPIError
    from core.logger import logger

    origin = forward_map.get(message.reply_to_message.message_id)

    if not origin:
        meta_match = re.search(
            r"\|\|origin_chat_id:(-?\d+)\|origin_msg_id:(\d+)\|\|",
            message.reply_to_message.text or "",
        )
        if not meta_match and message.reply_to_message.reply_to_message:
            meta_match = re.search(
                r"\|\|origin_chat_id:(-?\d+)\|origin_msg_id:(\d+)\|\|",
                message.reply_to_message.reply_to_message.text or "",
            )
        if meta_match:
            origin = (int(meta_match.group(1)), int(meta_match.group(2)))

    if not origin:
        return

    origin_chat_id, origin_msg_id = origin

    try:
        await bot.copy_message(
            origin_chat_id,
            message.chat.id,
            message.message_id,
            reply_to_message_id=origin_msg_id,
        )
    except TelegramAPIError as e:  # pragma: no cover - defensive
        logger.error(f"Не удалось отправить ответ пользователю: {e}")
