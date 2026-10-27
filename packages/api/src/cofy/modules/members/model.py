from datetime import datetime
from enum import StrEnum
from typing import Annotated

import energy_cost as ec
from energy_cost.data import ConnectionType, CustomerType
from pydantic import BaseModel, ConfigDict, Field


class MeterType(StrEnum):
    DAY_NIGHT_07 = "day_night_07"
    DAY_NIGHT_06 = "day_night_06"


class NamedIdentifier(BaseModel):
    # An entry of a list, such as a supplier or a region: its id is what is used, its name what is shown.
    model_config = ConfigDict(json_schema_extra={"x-named-identifier": True})

    name: Annotated[str, Field(..., description="The name shown.")]
    id: Annotated[str, Field(..., description="The identifier, as known to the energy cost catalog.")]


class Contract(BaseModel):
    """An energy contract of a grid connection."""

    ean: Annotated[str, Field(..., description="The EAN code of the connection.")]
    customer_type: CustomerType
    connection_type: ConnectionType
    supplier: Annotated[NamedIdentifier, Field(..., description="The energy supplier.")]
    product: Annotated[NamedIdentifier, Field(..., description="The supplier's product the contract is for.")]
    distributor: Annotated[
        NamedIdentifier, Field(..., description="The distribution system operator of the connection.")
    ]
    region: Annotated[NamedIdentifier, Field(..., description="The region the connection is in.")]
    start_date: Annotated[datetime, Field(..., description="When the contract starts.")]
    end_date: Annotated[datetime | None, Field(None, description="When the contract ends; empty while it runs.")] = None
    last_invoice_date: Annotated[datetime | None, Field(None, description="When the contract was last invoiced.")] = (
        None
    )
    is_green: Annotated[bool, Field(..., description="Whether the contract guarantees green energy.")]


def _build_product_key(supplier_id: str, product_id: str, meter_type: MeterType | None = None) -> str:
    if meter_type is None:
        return product_id
    supplier = ec.Supplier.get(supplier_id)

    if supplier is not None and f"{product_id}_{meter_type.value}" in supplier.products:
        # If the supplier has a product variant for the specified meter type, use that as the product key
        return f"{product_id}_{meter_type.value}"
    return product_id


def _build_contract_history(contracts: list[Contract], meter_type: MeterType | None = None) -> list[ec.Contract]:
    return [
        ec.Contract(
            start=c.start_date,
            end=c.end_date,
            region=c.region.id,
            connection_type=c.connection_type,
            customer_type=c.customer_type,
            distributor_key=c.distributor.id,
            supplier_key=c.supplier.id,
            product_key=_build_product_key(c.supplier.id, c.product.id, meter_type),
        )
        for c in contracts
    ]


class ECContractResponse(BaseModel):
    customer_type: CustomerType
    connection_type: ConnectionType
    region: str
    distributor_key: str
    supplier_key: str | None = None
    product_key: str | None = None
    start: datetime
    end: datetime | None
    supplier: ec.Tariff | list[ec.Tariff] | None = None


class Address(BaseModel):
    """An address of a member."""

    contracts: list[Contract] = Field(default_factory=list, description="The energy contracts at this address.")


class Member(BaseModel):
    """A member of the community."""

    id: str = Field(description="The member's identifier.")
    activation_code: Annotated[
        str | None, Field(None, description="The code a member enters to prove their membership.")
    ] = None
    addresses: list[Address] = Field(default_factory=list, description="The member's addresses, with their contracts.")

    def get_contract_history_for_ean(self, ean: str, meter_type: MeterType | None = None) -> list[ec.Contract] | None:
        contracts = [contract for address in self.addresses for contract in address.contracts if contract.ean == ean]
        if not contracts:
            return None
        return _build_contract_history(contracts, meter_type)


class VerifyMemberRequest(BaseModel):
    activation_code: str
