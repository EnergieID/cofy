"""Access: the permissions there are, and which identities a user record recognises."""

from cofy.management.auth.access import ROLE_PERMISSIONS, Action, Identity, Permission, Role, Subject, UserRecord

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


def test_a_community_admin_can_do_everything_in_its_community_but_change_it_or_the_allowed_types():
    assert set(Permission.all()) - ROLE_PERMISSIONS[Role.community_admin] == {
        Permission(action=action, subject=subject)
        for subject in (Subject.community, Subject.allowed_types)
        for action in (Action.create, Action.update, Action.delete)
    }


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
