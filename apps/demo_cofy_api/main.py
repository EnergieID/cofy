from pathlib import Path

from energy_cost import Supplier, Tariff
from energy_cost.index import CSVIndex, Index
from isodate import Duration

from cofy.api import CofyAPI, TokenAuth, TokenInfo
from cofy.integrations.demo import DemoBoundarySource, DemoPriceSource, DemoProductionSource, DemoRatioSource
from cofy.integrations.energy_cost import EnergyCostTariffSource
from cofy.modules.billing.module import BillingModule
from cofy.modules.directive import DirectiveModule, DirectiveSource, DynamicBoundaryDirectiveSource
from cofy.modules.members import MembersFileSource, MembersModule
from cofy.modules.production import ProductionModule
from cofy.modules.simultaneity import SimultaneityModule
from cofy.modules.tariff import KiwattFormat, TariffModule
from demo_cofy_api.members.load_from_csv import example_load_members_from_file

DATA_DIR = Path(__file__).resolve().parent / "data"

# Initialize the COFY API, with a fixed token: this demo serves generated data only
cofy = CofyAPI(auth=TokenAuth([TokenInfo(name="demo", description="Demo User", key="demo")]))

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

## Tariff app with a custom format
kiwatt = TariffModule(
    source=demo_prices,
    name="kiwatt",
    formats=[
        KiwattFormat(),
    ],
)
cofy.register_module(kiwatt)

## Tariff app with EnergyCost as source
TARIFF_CONFIG_PATH = str(DATA_DIR / "fixed_tariff.yaml")
fixed_tariff = TariffModule(
    source=EnergyCostTariffSource(Tariff.from_yaml(TARIFF_CONFIG_PATH)),
    name="fixed",
    description="Our fixed tariff.",
)
cofy.register_module(fixed_tariff)

## Billing app for our tariffs
Index.register("BelMonthly", CSVIndex(str(DATA_DIR / "monthly_index.csv"), resolution=Duration(months=1)))
Supplier.register(
    "eb",
    Supplier(
        products={
            "fixed": Tariff.from_yaml(TARIFF_CONFIG_PATH),
            "fixed_day_night_07": Tariff.from_yaml(str(DATA_DIR / "fixed_day_night_07.yaml")),
            "basic": Tariff.from_yaml(str(DATA_DIR / "basic_gas_tariff.yaml")),
            "pro": Tariff.from_yaml(str(DATA_DIR / "pro_gas_tariff.yaml")),
        }
    ),
)
cofy.register_module(BillingModule())

# members endpoint for Demo members, using a CSV file as source
CSV_PATH = str(DATA_DIR / "members_example.csv")
cofy.register_module(
    MembersModule(
        source=MembersFileSource(CSV_PATH, example_load_members_from_file),
        name="demo",
    )
)

# a directive module based on the generated prices, with custom boundaries
directive = DirectiveModule(
    source=DirectiveSource(
        source=demo_prices,
        boundaries=(0, 10, 25, 50),
        reverse=True,  # now low is good and high is bad, the opposite of the default behavior
    ),
    name="reversed",
    description="A directive module based on the generated prices, with custom boundaries.",
)
cofy.register_module(directive)


app = cofy
