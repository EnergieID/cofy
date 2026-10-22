import builtins
import datetime as dt
from typing import Literal
from zoneinfo import ZoneInfo

from pydantic import Field

from cofy.modules.members import (
    Address,
    ConnectionType,
    Contract,
    CustomerType,
    Member,
    MemberSource,
    MemberSourceSettings,
    NamedIdentifier,
)

SUPPLIER = NamedIdentifier(id="eb", name="Energie Belgie")
FLANDERS = NamedIdentifier(id="be_flanders", name="Flanders")
BRUSSELS = ZoneInfo("Europe/Brussels")

MEMBERS: list[Member] = [
    Member(
        id="M001",
        activation_code="ACT-M001",
        addresses=[
            Address(
                contracts=[
                    Contract(
                        ean="541448820059478667",
                        customer_type=CustomerType.RESIDENTIAL,
                        connection_type=ConnectionType.ELECTRICITY,
                        supplier=SUPPLIER,
                        product=NamedIdentifier(id="variable", name="Variable"),
                        distributor=NamedIdentifier(id="fluvius_antwerpen", name="Fluvius Antwerpen"),
                        region=FLANDERS,
                        start_date=dt.datetime(2012, 1, 21, tzinfo=BRUSSELS),
                        end_date=None,
                        last_invoice_date=None,
                        is_green=False,
                    ),
                    Contract(
                        ean="541100000002",
                        customer_type=CustomerType.RESIDENTIAL,
                        connection_type=ConnectionType.GAS,
                        supplier=SUPPLIER,
                        product=NamedIdentifier(id="basic", name="EB Basic Gas"),
                        distributor=NamedIdentifier(id="fluvius_kempen", name="Fluvius Kempen"),
                        region=FLANDERS,
                        start_date=dt.datetime(2012, 1, 21, tzinfo=BRUSSELS),
                        end_date=dt.datetime(2017, 12, 13, tzinfo=BRUSSELS),
                        last_invoice_date=dt.datetime(2017, 11, 1, tzinfo=BRUSSELS),
                        is_green=False,
                    ),
                ]
            )
        ],
    ),
    Member(
        id="M002",
        activation_code="ACT-M002",
        addresses=[
            Address(
                contracts=[
                    Contract(
                        ean="542700000001",
                        customer_type=CustomerType.NON_RESIDENTIAL,
                        connection_type=ConnectionType.ELECTRICITY,
                        supplier=SUPPLIER,
                        product=NamedIdentifier(id="fixed", name="Fixed"),
                        distributor=NamedIdentifier(id="fluvius_west", name="Fluvius West"),
                        region=FLANDERS,
                        start_date=dt.datetime(2025, 2, 15, tzinfo=BRUSSELS),
                        end_date=None,
                        last_invoice_date=None,
                        is_green=True,
                    )
                ]
            )
        ],
    ),
]


class DemoMembersSourceSettings(MemberSourceSettings):
    type: Literal["demo_members"] = "demo_members"
    members: list[Member] = Field(MEMBERS, description="The members.")


class DemoMembersSource(MemberSource[Member], settings=DemoMembersSourceSettings):
    """Example members, for demos."""

    def __init__(self, members: builtins.list[Member] = MEMBERS):
        self.members = {member.id: member for member in members}

    def list(self) -> builtins.list[Member]:
        return builtins.list(self.members.values())

    def get(self, member_id: str) -> Member | None:
        return self.members.get(member_id)

    def verify(self, activation_code: str) -> Member | None:
        return next((member for member in self.members.values() if member.activation_code == activation_code), None)
