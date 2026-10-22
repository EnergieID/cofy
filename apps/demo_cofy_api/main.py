from os import environ
from pathlib import Path

from energy_cost import Supplier, Tariff
from energy_cost.index import CachedIndex, CSVIndex, EntsoeDayAheadIndex, Index
from isodate import Duration

from cofy.api import CofyAPI, TokenAuth, TokenInfo
from cofy.integrations.energy_cost import EnergyCostTariffSource
from cofy.integrations.demo import DemoBoundarySource, DemoPriceSource, DemoProductionSource, DemoRatioSource
from cofy.integrations.energyid import EnergyIDProduction
from cofy.integrations.entsoe import EntsoeDayAheadTariffSource
from cofy.modules.billing.module import BillingModule
from cofy.modules.directive import DirectiveModule, DirectiveSource, DynamicBoundaryDirectiveSource
from cofy.modules.members import MembersFileSource, MembersModule
from cofy.modules.production import ProductionModule
from cofy.modules.simultaneity import SimultaneityModule
from cofy.modules.tariff import KiwattFormat, TariffModule
from cofy.modules.timeseries import CacheSettings
from demo_cofy_api.members.load_from_csv import example_load_members_from_file

DATA_DIR = Path(__file__).resolve().parent / "data"

# Initialize the Cofy API
cofy = CofyAPI(
    auth=TokenAuth([TokenInfo(name="demo", description="Demo User", key=environ["COFY_API_TOKEN"])]),
    debug_mode=environ.get("COFY_DEBUG", "").lower() in ("1", "true", "yes"),
)

# cached, so frequent requests (including the directive module below, which shares this source) don't all hit ENTSO-E
entsoe = TariffModule(
    source=EntsoeDayAheadTariffSource(
        api_key=environ.get("ENTSOE_API_KEY", ""),
        cache=CacheSettings(),
    ),
    name="entsoe",
)
cofy.register_module(entsoe)

## Tariff app with custom source
source = EntsoeDayAheadTariffSource(
    country_code="NL",
    api_key=environ.get("ENTSOE_API_KEY", ""),
    cache=CacheSettings(),
)
kiwatt = TariffModule(
    source=source,
    name="kiwatt",
    formats=[
        KiwattFormat(),
    ],
)
cofy.register_module(kiwatt)

## Tariff app with EnergyCost as source
Index.register(
    "Belpex15min",
    CachedIndex(EntsoeDayAheadIndex("BE", api_key=environ.get("ENTSOE_API_KEY", "")), file_name="belpex15min"),
)
TARIFF_CONFIG_PATH = str(DATA_DIR / "dynamic_tariff.yaml")
dynamic_tariff = TariffModule(
    source=EnergyCostTariffSource(Tariff.from_yaml(TARIFF_CONFIG_PATH)),
    name="dynamic",
    description="Our dynamic tariff tracking the Belpex.",
)
cofy.register_module(dynamic_tariff)

## Billing app for our tariff
Index.register("BelMonthly", CSVIndex(str(DATA_DIR / "monthly_index.csv"), resolution=Duration(months=1)))
Supplier.register(
    "eb",
    Supplier(
        products={
            "fixed": Tariff.from_yaml(str(DATA_DIR / "fixed_tariff.yaml")),
            "fixed_day_night_07": Tariff.from_yaml(str(DATA_DIR / "fixed_day_night_07.yaml")),
            "variable": Tariff.from_yaml(str(DATA_DIR / "variable_tariff.yaml")),
            "dynamic": Tariff.from_yaml(TARIFF_CONFIG_PATH),
            "basic": Tariff.from_yaml(str(DATA_DIR / "basic_gas_tariff.yaml")),
            "pro": Tariff.from_yaml(str(DATA_DIR / "pro_gas_tariff.yaml")),
        }
    ),
)
cofy.register_module(BillingModule())

## Production app with EnergyID as source
wind = ProductionModule(
    source=EnergyIDProduction(
        api_key=environ.get("ENERGY_ID_API_KEY", ""),
        record_id=environ.get("ENERGY_ID_RECORD_ID", ""),
    ),
    name="wind",
)
cofy.register_module(wind)

# members endpoint for Demo members, using a CSV file as source
CSV_PATH = str(DATA_DIR / "members_example.csv")
cofy.register_module(
    MembersModule(
        source=MembersFileSource(CSV_PATH, example_load_members_from_file),
        name="demo",
    )
)

# a directive module based on the entsoe day-ahead prices, with custom boundaries
directive = DirectiveModule(
    source=DirectiveSource(
        source=entsoe.source,
        boundaries=(0, 10, 25, 50),
        reverse=True,  # now low is good and high is bad, the opposite of the default behavior
    ),
    name="entsoe",
    description="A directive module based on the entsoe day-ahead prices, with custom boundaries.",
)
cofy.register_module(directive)

## Generated data, to try the modules without any credentials
demo_prices = DemoPriceSource(noise=0.1)
cofy.register_module(TariffModule(source=demo_prices, name="demo", description="Generated day-ahead prices."))
cofy.register_module(
    ProductionModule(source=DemoProductionSource(noise=0.2), name="demo", description="Generated solar production.")
)
cofy.register_module(
    SimultaneityModule(source=DemoRatioSource(noise=0.1), name="demo", description="Generated simultaneity.")
)
cofy.register_module(
    DirectiveModule(
        source=DynamicBoundaryDirectiveSource(signal_source=demo_prices, boundary_source=DemoBoundarySource()),
        name="demo",
        description="A directive following generated prices, between boundaries that change during the day.",
    )
)


app = cofy
