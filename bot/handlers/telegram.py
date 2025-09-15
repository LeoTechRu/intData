# /sd/intdata/bot/handlers/telegram.py
import re

from aiogram import Router, F
from aiogram.filters import Command
from aiogram.types import Message
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from datetime import datetime, date, timedelta, timezone
from typing import Callable, Optional, Tuple, List
from decorators import role_required, group_required
from core.models import GroupType, LogLevel, UserRole, ProductStatus, TgUser
from core.services.telegram_user_service import TelegramUserService
from core.services.crm_service import CRMService
from core.services.group_moderation_service import GroupModerationService

# ==============================
# РОУТЕРЫ
# ==============================
router = Router()
user_router = Router()
group_router = Router()


def _parse_group_subcommand(message: Message) -> Tuple[Optional[str], str]:
    """Split `/group` command into subcommand and remainder."""
    text = (message.text or "").strip()
    tokens = text.split(maxsplit=2)
    if len(tokens) <= 1:
        return None, ""
    subcommand = tokens[1].lower()
    remainder = tokens[2] if len(tokens) == 3 else ""
    return subcommand, remainder.strip()


def _format_member_name(user: TgUser) -> str:
    if user.username:
        return f"@{user.username}"
    full = f"{user.first_name or ''} {user.last_name or ''}".strip()
    return full or str(user.telegram_id)


async def _resolve_target_user(
    message: Message,
    identifier: Optional[str],
    service: TelegramUserService,
) -> Optional[TgUser]:
    if message.reply_to_message and message.reply_to_message.from_user:
        reply_user = message.reply_to_message.from_user
        tg_user, _ = await service.get_or_create_user(
            reply_user.id,
            username=reply_user.username,
            first_name=reply_user.first_name,
            last_name=reply_user.last_name,
            language_code=reply_user.language_code,
        )
        return tg_user
    if not identifier:
        return None
    identifier = identifier.strip()
    if identifier.startswith("@"):
        return await service.get_user_by_username(identifier[1:])
    if identifier.isdigit():
        return await service.get_user_by_telegram_id(int(identifier))
    return None

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
# Справка по командам
# -----------------------------

GROUP_CHAT_TYPES = frozenset({"group", "supergroup"})

HELP_SECTIONS = (
    (
        "Общие",
        (
            {"text": "/start - приветствие и справка."},
            {"text": "/help - показать эту справку."},
            {"text": "/cancel - отменить ввод."},
        ),
    ),
    (
        "Профиль",
        (
            {"text": "/contact - показать контактные данные."},
            {"text": "/setfullname - установить отображаемое имя."},
            {"text": "/setemail - установить email."},
            {"text": "/setphone - установить телефон."},
            {"text": "/setbirthday - установить день рождения."},
            {"text": "/birthday - напоминание о дне рождения."},
        ),
    ),
    (
        "Заметки",
        (
            {"text": "/note <текст> - создать заметку в Inbox (#proj:<id> для проекта)."},
            {"text": "/assign <note_id> <proj|area|res> <id> - присвоить заметку контейнеру."},
        ),
    ),
    (
        "Привычки",
        (
            {"text": "/habit_list - список привычек."},
            {"text": "/habit_add [название] [daily|weekly|monthly] - добавить привычку."},
            {"text": "/habit_done [id] - отметить выполнение за сегодня."},
        ),
    ),
    (
        "Тайм-трекер",
        (
            {"text": "/time_start [описание] - запустить таймер."},
            {"text": "/time_stop [id] - остановить таймер."},
            {"text": "/time_list - последние записи времени."},
            {"text": "/time_resume <task_id> - возобновить таймер для задачи."},
        ),
    ),
    (
        "Группы",
        (
            {
                "text": "/group - зарегистрировать группу и показать участников.",
                "chat_types": GROUP_CHAT_TYPES,
            },
            {
                "text": "/group audit [дней] [product] - статистика активности и оплат.",
                "chat_types": GROUP_CHAT_TYPES,
            },
            {
                "text": "/group mark <product> [@user|id] [status] - отметить покупку.",
                "chat_types": GROUP_CHAT_TYPES,
                "min_role": UserRole.moderator,
            },
            {
                "text": "/group note [@user|id] текст [--trial=YYYY-MM-DD] [--tags=a,b] - заметка о участнике.",
                "chat_types": GROUP_CHAT_TYPES,
                "min_role": UserRole.moderator,
            },
            {
                "text": "/setgroupdesc - задать описание группы (в группах).",
                "chat_types": GROUP_CHAT_TYPES,
            },
        ),
    ),
    (
        "Администрирование",
        (
            {
                "text": "/setloglevel <DEBUG|INFO|ERROR> - установить уровень логирования.",
                "min_role": UserRole.admin,
            },
            {
                "text": "/getloglevel - показать текущий уровень логов.",
                "min_role": UserRole.admin,
            },
        ),
    ),
)


def _resolve_user_role(user: Optional[TgUser]) -> UserRole:
    if user and getattr(user, "role", None):
        try:
            return UserRole[user.role]
        except KeyError:
            return UserRole.single
    return UserRole.single


def _build_help_text(role: UserRole, chat_type: Optional[str]) -> str:
    chat_type = chat_type or "private"
    sections: List[str] = []
    for title, items in HELP_SECTIONS:
        lines: List[str] = []
        for item in items:
            min_role: UserRole = item.get("min_role", UserRole.single)
            allowed_chats = item.get("chat_types")
            if role.value < min_role.value:
                continue
            if allowed_chats and chat_type not in allowed_chats:
                continue
            lines.append(item["text"])
        if lines:
            sections.append(f"{title}:\n" + "\n".join(lines))
    if not sections:
        return ""
    return "Доступные команды:\n\n" + "\n\n".join(sections)


async def _send_help_reply(message: Message, *, include_greeting: bool) -> None:
    from_user = message.from_user
    if not from_user:
        return
    async with TelegramUserService() as user_service:
        user, _ = await user_service.get_or_create_user(
            from_user.id,
            username=from_user.username,
            first_name=from_user.first_name,
            last_name=from_user.last_name,
            language_code=from_user.language_code,
            is_premium=getattr(from_user, "is_premium", None),
        )

    role = _resolve_user_role(user)
    chat_type = getattr(message.chat, "type", "private")
    if include_greeting:
        first_name = from_user.first_name or "друг"
        await message.answer(f"Привет, {first_name}! Добро пожаловать в бота.")

    help_text = _build_help_text(role, chat_type)
    if help_text:
        await message.answer(help_text)

# -----------------------------
# Команды
# -----------------------------
@router.message(Command("start"))
@user_router.message(F.text.lower().in_(["старт", "start", "привет", "hello"]))
async def cmd_start(message: Message):
    await _send_help_reply(message, include_greeting=True)


@user_router.message(Command("help"))
async def cmd_help(message: Message) -> None:
    await _send_help_reply(message, include_greeting=False)

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
    subcommand, remainder = _parse_group_subcommand(message)
    if subcommand == "audit":
        await handle_group_audit(message, remainder)
        return
    if subcommand == "mark":
        await handle_group_mark(message, remainder)
        return
    if subcommand == "note":
        await handle_group_note(message, remainder)
        return

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


async def handle_group_audit(message: Message, remainder: str) -> None:
    if message.chat.type not in {"group", "supergroup"}:
        await message.answer("Команда доступна только в группах")
        return

    tokens = remainder.split()
    days = 7
    product_slug: Optional[str] = None
    for token in tokens:
        lowered = token.lower()
        if lowered.isdigit():
            days = max(1, min(180, int(lowered)))
        elif lowered.startswith("product=") or lowered.startswith("p="):
            product_slug = lowered.split("=", 1)[1]
        elif product_slug is None:
            product_slug = lowered

    since_date = date.today() - timedelta(days=days)
    async with TelegramUserService() as tsvc:
        await tsvc.get_or_create_group(
            message.chat.id,
            title=message.chat.title,
            type=GroupType(message.chat.type),
            owner_id=message.from_user.id if message.from_user else None,
        )
        crm = CRMService(tsvc.session)
        moderation = GroupModerationService(tsvc.session, crm=crm)
        product = None
        if product_slug:
            product = await crm.get_product_by_slug(product_slug)
            if not product:
                await message.answer(
                    "Продукт не найден. Создайте его через веб-интерфейс или отметьте покупку командой `/group mark`.",
                    parse_mode="Markdown",
                )
                return
        roster = await moderation.list_group_members(
            message.chat.id, since=since_date
        )
        leaderboard = await moderation.activity_leaderboard(
            message.chat.id, since=since_date, limit=5
        )

    total_members = len(roster)
    buyers = 0
    missing: List[str] = []
    quiet: List[str] = []

    for entry in roster:
        activity = entry["activity"]
        if activity.messages == 0 and activity.reactions == 0:
            quiet.append(_format_member_name(entry["user"]))
        if product:
            has_paid = any(
                link.product_id == product.id
                and link.status == ProductStatus.paid
                for link in entry["products"]
            )
            if has_paid:
                buyers += 1
            else:
                missing.append(_format_member_name(entry["user"]))

    title = message.chat.title or str(message.chat.id)
    lines = [
        f"Отчёт по группе «{title}» за {days} дн.",
        f"Участников: {total_members}",
    ]

    if product:
        lines.append(
            f"Покупка {product.title}: {buyers}/{total_members} с оплаченной записью"
        )
        if missing:
            preview = ", ".join(missing[:5])
            if len(missing) > 5:
                preview += "…"
            lines.append(f"Без оплаты ({len(missing)}): {preview}")

    if quiet:
        preview = ", ".join(quiet[:5])
        if len(quiet) > 5:
            preview += "…"
        lines.append(f"Тихие участники ({len(quiet)}): {preview}")

    if leaderboard:
        lines.append("")
        lines.append("Лидборд активности:")
        for idx, entry in enumerate(leaderboard, start=1):
            user = entry.get("user")
            name = (
                _format_member_name(user)
                if user
                else str(entry.get("user_id"))
            )
            last_seen = entry.get("last_activity")
            last_str = last_seen.strftime("%d.%m %H:%M") if last_seen else "—"
            lines.append(
                f"{idx}. {name} — {entry['messages']} сообщений, {entry['reactions']} реакций (последняя активность {last_str} UTC)"
            )

    lines.append("")
    lines.append("Полный контроль и массовое управление доступны на https://intdata.pro/groups")
    await message.answer("\n".join(lines))


async def handle_group_mark(message: Message, remainder: str) -> None:
    if message.chat.type not in {"group", "supergroup"}:
        await message.answer("Команда доступна только в группах")
        return

    tokens = remainder.split()
    if not tokens:
        await message.answer(
            "Использование: /group mark <product_slug> [@username|id] [status] [--source=tag]"
        )
        return

    slug = tokens[0].lower()
    target_token: Optional[str] = None
    status_token = "paid"
    source: Optional[str] = None
    note_parts: List[str] = []

    for token in tokens[1:]:
        lowered = token.lower()
        if lowered.startswith("--source="):
            source = token.split("=", 1)[1]
        elif lowered in {s.value for s in ProductStatus} and status_token == "paid":
            status_token = lowered
        elif lowered in {"оплатил", "оплачено"}:
            status_token = ProductStatus.paid.value
        elif token.startswith("@") or token.isdigit():
            if target_token is None:
                target_token = token
            else:
                note_parts.append(token)
        else:
            note_parts.append(token)

    async with TelegramUserService() as tsvc:
        crm = CRMService(tsvc.session)
        product = await crm.get_product_by_slug(slug)
        if not product:
            product = await crm.ensure_product(
                slug=slug,
                title=slug.replace("_", " ").title(),
            )

        actor, _ = await tsvc.get_or_create_user(
            message.from_user.id,
            username=message.from_user.username,
            first_name=message.from_user.first_name,
            last_name=message.from_user.last_name,
            language_code=message.from_user.language_code,
        )
        if UserRole[actor.role].value < UserRole.moderator.value:
            await message.answer("Требуется роль модератора или выше")
            return

        target = await _resolve_target_user(message, target_token, tsvc)
        if not target:
            await message.answer(
                "Не удалось найти пользователя. Ответьте на сообщение участника или укажите @username/ID."
            )
            return

        if not await tsvc.is_user_in_group(target.telegram_id, message.chat.id):
            await message.answer("Пользователь не найден в этой группе")
            return

        status_map = {status.value: status for status in ProductStatus}
        status = status_map.get(status_token, ProductStatus.paid)

        note = " ".join(note_parts).strip() or None
        await crm.assign_product(
            user_id=target.telegram_id,
            product_id=product.id,
            status=status,
            source=source,
            notes=note,
        )

    summary = (
        f"{_format_member_name(target)} → {product.title} [{status.value}]"
    )
    if source:
        summary += f" через {source}"
    if note:
        summary += f" · заметка сохранена"
    await message.answer(summary)


async def handle_group_note(message: Message, remainder: str) -> None:
    if message.chat.type not in {"group", "supergroup"}:
        await message.answer("Команда доступна только в группах")
        return

    tokens = remainder.split()
    target_token: Optional[str] = None
    trial_value: Optional[str] = None
    tags_value: Optional[List[str]] = None
    note_tokens: List[str] = []

    for token in tokens:
        if target_token is None and (token.startswith("@") or token.isdigit()):
            target_token = token
            continue
        lowered = token.lower()
        if lowered.startswith("--trial="):
            trial_value = token.split("=", 1)[1]
            continue
        if lowered.startswith("--tags="):
            raw = token.split("=", 1)[1]
            tags_value = [value.strip() for value in raw.split(",") if value.strip()]
            continue
        note_tokens.append(token)

    note_text = " ".join(note_tokens).strip()

    async with TelegramUserService() as tsvc:
        actor, _ = await tsvc.get_or_create_user(
            message.from_user.id,
            username=message.from_user.username,
            first_name=message.from_user.first_name,
            last_name=message.from_user.last_name,
            language_code=message.from_user.language_code,
        )
        if UserRole[actor.role].value < UserRole.moderator.value:
            await message.answer("Требуется роль модератора или выше")
            return

        target = await _resolve_target_user(message, target_token, tsvc)
        if not target:
            await message.answer(
                "Не удалось найти пользователя. Ответьте на сообщение участника или укажите @username/ID."
            )
            return

        if not await tsvc.is_user_in_group(target.telegram_id, message.chat.id):
            await message.answer("Пользователь не найден в этой группе")
            return

        trial_dt: Optional[datetime] = None
        if trial_value:
            try:
                parsed = datetime.strptime(trial_value, "%Y-%m-%d")
                trial_dt = parsed.replace(tzinfo=timezone.utc)
            except ValueError:
                await message.answer("Используйте формат trial=YYYY-MM-DD")
                return

        moderation = GroupModerationService(tsvc.session)
        updated = await moderation.update_member_profile(
            group_id=message.chat.id,
            user_id=target.telegram_id,
            notes=note_text or None,
            trial_expires_at=trial_dt,
            tags=tags_value,
        )
        if not updated:
            await message.answer("Не удалось обновить карточку участника")
            return

    parts = [f"Заметка для {_format_member_name(target)} обновлена"]
    if note_text:
        parts.append(f"Текст: {note_text}")
    if trial_dt:
        parts.append(f"Пробный доступ до {trial_dt.date()}")
    if tags_value:
        parts.append("Теги: " + ", ".join(tags_value))
    await message.answer("\n".join(parts))


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
