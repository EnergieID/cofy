from pathlib import Path

import yaml
from energy_cost.index import CSVIndex, Index
from isodate import Duration

from cofy.api import CofyAPI
from cofy.modules.discovery import discover_all_types

# Register every installed module, source and format type, so the settings can use any of them.
discover_all_types()

DATA_DIR = Path(__file__).resolve().parent / "data"
SETTINGS_PATH = Path(__file__).resolve().parent / "settings.yaml"

# Pre-register indexes used by tariff and billing flows.
Index.register("BelMonthly", CSVIndex(str(DATA_DIR / "monthly_index.csv"), resolution=Duration(months=1)))

settings = yaml.safe_load(SETTINGS_PATH.read_text())
cofy = CofyAPI.create(settings)

app = cofy
