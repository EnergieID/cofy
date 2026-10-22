from cofy.integrations.demo import DemoMembersSource
from cofy.modules.members import Member, MemberSource


def test_has_example_members():
    source = MemberSource.create({"type": "demo_members"})
    assert [member.id for member in source.list()] == ["M001", "M002"]


def test_finds_a_member_by_id_and_by_activation_code():
    source = DemoMembersSource([Member(id="a", activation_code="code-a"), Member(id="b")])
    assert source.get("b") == Member(id="b")
    assert source.get("c") is None
    assert source.verify("code-a") == Member(id="a", activation_code="code-a")
    assert source.verify("wrong") is None


def test_every_example_date_has_an_offset():
    """As the `date-time` format the console reads them with requires one."""
    source = DemoMembersSource()
    dates = [
        date
        for member in source.list()
        for address in member.addresses
        for contract in address.contracts
        for date in (contract.start_date, contract.end_date, contract.last_invoice_date)
        if date is not None
    ]
    assert dates and all(date.tzinfo is not None for date in dates)
