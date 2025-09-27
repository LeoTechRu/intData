from __future__ import annotations

from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message

from backend.services.note_service import NoteService
from backend.services.para_service import ParaService
from backend.models import ContainerType


router = Router()


@router.message(Command("note"))
async def cmd_note(message: Message) -> None:
    """Create a quick note into Inbox. Usage: /note <text>

    Minimal parser: if text contains token like #proj:<id>, assign to that project.
    """
    text = (message.text or "").split(maxsplit=1)
    if len(text) < 2:
        await message.answer("Использование: /note <текст>")
        return
    content = text[1].strip()
    project_id = None
    # naive pattern: #proj:123
    for tok in content.split():
        if tok.startswith("#proj:") and tok[6:].isdigit():
            project_id = int(tok[6:])
            content = content.replace(tok, "").strip()
            break

    async with NoteService() as nsvc:
        note = await nsvc.create_note(owner_id=message.from_user.id, content=content)
        if project_id is not None:
            # assign to project (best-effort)
            try:
                await nsvc.assign_container(
                    note.id,
                    owner_id=message.from_user.id,
                    container_type=ContainerType.project,
                    container_id=project_id,
                )
            except Exception:
                pass
    await message.answer(f"Заметка создана: #{note.id}")


@router.message(Command("assign"))
async def cmd_assign(message: Message) -> None:
    """Assign a note to container. Usage: /assign <note_id> <proj|area|res> <id>"""
    args = (message.text or "").split()
    if len(args) != 4:
        await message.answer("Пример: /assign 12 proj 3")
        return
    _, note_id_s, kind, cid_s = args
    if not note_id_s.isdigit() or not cid_s.isdigit():
        await message.answer("ID должны быть числами: /assign 12 proj 3")
        return
    note_id = int(note_id_s)
    cid = int(cid_s)
    try:
        ctype = {
            "proj": ContainerType.project,
            "project": ContainerType.project,
            "area": ContainerType.area,
            "res": ContainerType.resource,
            "resource": ContainerType.resource,
        }[kind.lower()]
    except KeyError:
        await message.answer("Тип контейнера: proj|area|res")
        return

    async with NoteService() as nsvc:
        note = await nsvc.assign_container(
            note_id,
            owner_id=message.from_user.id,
            container_type=ctype,
            container_id=cid,
        )
        if not note:
            await message.answer("Заметка не найдена или не принадлежит вам")
            return
    await message.answer(f"Готово. Заметка #{note_id} присвоена {ctype.value} #{cid}")

