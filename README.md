# Weather Glass Card

An animated weather card for Home Assistant dashboards. Choose a Home Assistant weather entity or enter a city directly. Each card can show a different location, making it easy to compare places across dashboards.

**Author:** Vinoth Sakthivel · [vinoth@kandiyar.com](mailto:vinoth@kandiyar.com)

## Features

- Per-card location search by city, region, or country
- Optional use of an existing Home Assistant `weather.*` entity
- Celsius, Fahrenheit, or Home Assistant's configured temperature unit
- Current conditions, feels-like temperature, humidity, wind, and daily forecast
- Configurable forecast length and animated weather artwork
- Visual card editor and YAML configuration
- No API key required for location-based weather

## Install with HACS

1. In Home Assistant, open **HACS** and select the menu in the upper-right corner.
2. Choose **Custom repositories**.
3. Add `https://github.com/KANDIYARR/weather-glass-card` and select **Dashboard** as the category.
4. Select **Add**, open Weather Glass Card in HACS, and choose **Download**.
5. Refresh the dashboard, add **Weather Glass Card**, and choose a source in its visual editor.

HACS downloads the card and registers its dashboard resource. Manual file copying and resource configuration are not required. The GitHub repository must be public.

## Choose a weather source

### Search by location

Choose **Search by location** in the card editor and enter a city, region, or country, such as `Manama, Bahrain`. Each card performs its own location search and loads its own weather, so different cards can display different places. Add a region or country when a city name is ambiguous.

Location-based weather is provided by [Open-Meteo](https://open-meteo.com/). It requires an internet connection from the browser and does not require an API key. Open-Meteo's free API is for non-commercial use; commercial use requires a customer API. The card links to Open-Meteo for attribution.

### Use a Home Assistant weather entity

Choose **Home Assistant weather entity** and select an available `weather.*` entity. This uses the location and data already provided by that integration and does not make direct requests to Open-Meteo.

## Configuration

For location-based weather:

```yaml
type: custom:weather-glass-card
source: open_meteo
location: Manama, Bahrain
unit: C
show_forecast: true
forecast_days: 4
animated: true
```

For a Home Assistant weather entity:

```yaml
type: custom:weather-glass-card
source: entity
entity: weather.forecast_home
location_label: Home
unit: auto
show_forecast: true
forecast_days: 4
animated: true
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `source` | string | Based on `entity` | `open_meteo` to search by location, or `entity` to use Home Assistant |
| `location` | string | Empty | City, region, or country to look up when `source: open_meteo` |
| `entity` | string | Required for entity source | Home Assistant weather entity |
| `location_label` | string | Resolved place or entity name | Optional title displayed on the card |
| `unit` | string | `auto` | Temperature unit: `auto`, `C`, or `F` |
| `show_forecast` | boolean | `true` | Show the forecast when available |
| `forecast_days` | number | `4` | Number of forecast days to display (1–7) |
| `animated` | boolean | `true` | Enable animation for the weather artwork |

Existing configurations with `entity` and `location` continue to use the weather entity; `location` remains its display label. Use `source: open_meteo` to make `location` select the actual place.

## Troubleshooting

- **HACS reports that `manifest.json` is missing:** add this repository as a **Dashboard** custom repository. It is a dashboard card, not a Home Assistant integration.
- **Location search finds the wrong place:** include the region or country, for example `Springfield, Illinois, USA`.
- **Location weather does not load:** ensure the browser has internet access to Open-Meteo and try a more specific place name.
- **The forecast is empty with an entity source:** confirm that the selected integration provides forecast data.

## Support

When reporting an issue, include your Home Assistant version, the selected weather source, and any relevant browser-console errors.
