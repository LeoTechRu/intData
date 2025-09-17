import pytest
from sqlalchemy import select

from core.models import WebUser, EntityProfile, EntityProfileGrant
from core.services.profile_service import ProfileService


@pytest.mark.asyncio
async def test_private_profiles_require_explicit_grant(session):
    viewer = WebUser(username="viewer", password_hash="x", role="single")
    owner = WebUser(username="owner", password_hash="x", role="single")
    session.add_all([viewer, owner])
    await session.flush()

    profile = EntityProfile(
        entity_type="user",
        entity_id=owner.id,
        slug="owner",
        display_name="Owner Example",
    )
    session.add(profile)
    await session.commit()

    service = ProfileService(session)
    db_profile = await session.scalar(
        select(EntityProfile).where(
            EntityProfile.entity_type == "user",
            EntityProfile.entity_id == owner.id,
        )
    )
    assert db_profile is not None

    await service.apply_visibility(db_profile, "private", actor=owner)
    await session.commit()

    assert await service.list_catalog(entity_type="user", viewer=viewer) == []
    with pytest.raises(PermissionError):
        await service.get_profile(entity_type="user", slug="owner", viewer=viewer)

    session.add(
        EntityProfileGrant(
            profile_id=db_profile.id,
            audience_type="user",
            subject_id=viewer.id,
        )
    )
    await session.commit()

    catalog = await service.list_catalog(entity_type="user", viewer=viewer)
    assert [item.profile.slug for item in catalog] == ["owner"]
    access = await service.get_profile(entity_type="user", slug="owner", viewer=viewer)
    assert access.profile.display_name == "Owner Example"


@pytest.mark.asyncio
async def test_owner_profile_bootstrap(session):
    owner = WebUser(
        username="AlphaTeam",
        password_hash="x",
        role="single",
        full_name="Alpha Team",
    )
    stranger = WebUser(username="viewer", password_hash="x", role="single")
    session.add_all([owner, stranger])
    await session.commit()

    service = ProfileService(session)

    owner_ref = await session.get(WebUser, owner.id)
    access = await service.get_profile(
        entity_type="user",
        slug="AlphaTeam",
        viewer=owner_ref,
    )

    assert access.is_owner is True
    assert access.profile.slug == "alphateam"
    assert access.profile.display_name == "Alpha Team"
    assert access.profile.profile_meta.get("visibility") == "private"
    assert len(access.sections) >= 1

    stranger_ref = await session.get(WebUser, stranger.id)
    with pytest.raises(PermissionError):
        await service.get_profile(
            entity_type="user",
            slug=access.profile.slug,
            viewer=stranger_ref,
        )
