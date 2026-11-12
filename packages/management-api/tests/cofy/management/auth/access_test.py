"""Access: the permissions there are, and which identities a user record recognises."""

import pytest
from cofy.api import hash_key

from cofy.management.auth.access import (
    GLOBAL_ROLE_PERMISSIONS,
    ROLE_PERMISSIONS,
    Action,
    ClientRecord,
    GlobalRole,
    Identity,
    Permission,
    Role,
    Subject,
    UserRecord,
    UsersFile,
)

ISSUER = "https://identity.example"


def identity(email: str | None = "ann@example.com", *, verified: bool = True, subject: str = "ann-sub") -> Identity:
    return Identity(issuer=ISSUER, subject=subject, email=email, email_verified=verified)


def record(email: str = "ann@example.com", issuer: str | None = None, subject: str | None = None) -> UserRecord:
    return UserRecord(email=email, issuer=issuer, subject=subject)


# ── matching ──────────────────────────────────────────────────────────────


def test_an_unbound_record_matches_a_verified_email_ignoring_case():
    assert record("Ann@Example.com").matches(identity("ann@example.COM"))


def test_an_unbound_record_never_matches_an_unverified_email():
    assert not record().matches(identity(verified=False))


def test_an_unbound_record_never_matches_without_an_email():
    assert not record().matches(identity(None))


def test_an_unbound_record_does_not_match_another_email():
    assert not record().matches(identity("bob@example.com"))


def test_a_bound_record_matches_its_identity_whatever_its_email_now_is():
    assert record(issuer=ISSUER, subject="ann-sub").matches(identity("ann@elsewhere.example"))


def test_a_bound_record_no_longer_matches_its_email_alone():
    assert not record(issuer=ISSUER, subject="ann-sub").matches(identity(subject="someone-else"))


def test_a_bound_record_does_not_match_the_same_subject_at_another_issuer():
    assert not record(issuer="https://other.example", subject="ann-sub").matches(identity())


def test_binding_stores_the_identity():
    unbound = record()

    unbound.bind(identity())

    assert (unbound.issuer, unbound.subject) == (ISSUER, "ann-sub")
    assert unbound.bound


# ── roles ─────────────────────────────────────────────────────────────────


def test_every_role_carries_permissions():
    assert set(ROLE_PERMISSIONS) == set(Role)


def test_every_action_on_every_subject_is_a_permission():
    assert len(Permission.all()) == len(Action) * len(Subject)


def test_a_community_admin_can_do_everything_in_its_community_but_change_it_the_allowed_types_or_managed_grants():
    assert set(Permission.all()) - ROLE_PERMISSIONS[Role.community_admin] == {
        Permission(action=action, subject=subject)
        for subject in (Subject.community, Subject.allowed_types)
        for action in (Action.create, Action.update, Action.delete)
    } | {Permission(action=action, subject=Subject.managed_grants) for action in Action}


def test_every_global_role_carries_permissions():
    assert set(GLOBAL_ROLE_PERMISSIONS) == set(GlobalRole)


def test_a_community_editor_can_see_their_community_update_its_modules_and_manage_its_resources_and_secrets():
    assert ROLE_PERMISSIONS[Role.community_editor] == {
        Permission(action=Action.read, subject=Subject.community),
        Permission(action=Action.read, subject=Subject.modules),
        Permission(action=Action.update, subject=Subject.modules),
        *(
            Permission(action=action, subject=subject)
            for subject in (Subject.resources, Subject.secrets)
            for action in Action
        ),
    }


def test_the_integration_role_looks_after_tokens_and_grants_but_not_the_configuration():
    subjects = {permission.subject for permission in ROLE_PERMISSIONS[Role.integration]}

    assert subjects == {Subject.community, Subject.tokens, Subject.grants, Subject.managed_grants}
    assert Permission(action=Action.update, subject=Subject.community) not in ROLE_PERMISSIONS[Role.integration]


def test_a_managed_grant_needs_a_role_to_manage():
    with pytest.raises(ValueError, match="no role there"):
        UserRecord(email="ann@example.com", managed_by={"test": "energyid"})


def client_named(name: str, key: str) -> ClientRecord:
    return ClientRecord(name=name, hash=hash_key(key))


@pytest.mark.parametrize(
    ("clients", "field"),
    [
        ([client_named("a", "one"), client_named("a", "two")], "name"),
        ([client_named("a", "one"), client_named("b", "one")], "hash"),
    ],
)
def test_each_client_needs_a_name_and_a_key_of_its_own(clients: list[ClientRecord], field: str):
    with pytest.raises(ValueError, match=f"a {field} of its own"):
        UsersFile(clients=clients)


def test_a_client_is_known_by_the_hash_of_its_key_only():
    with pytest.raises(ValueError):
        ClientRecord(name="energyid", hash="cofy_the-key-itself")
