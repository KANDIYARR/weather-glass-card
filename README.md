# Weather Glass Card

An animated, configurable Home Assistant dashboard card. It reads current conditions and forecast from one of your existing `weather.*` entities, so it needs no API key or extra weather service.

## Install with HACS

1. In Home Assistant, open **HACS → ⋮ → Custom repositories**.
2. Add `https://github.com/KANDIYARR/weather-glass-card` and choose **Dashboard** as the category.
3. Find **Weather Glass Card** in HACS and select **Download**.
4. Refresh your browser, add a **Weather Glass Card** to a dashboard, and select your weather entity in the card editor.

HACS downloads the card and registers its dashboard resource automatically. No manual file copying or resource URL setup is needed. The repository must be public on GitHub for HACS to install it.

## Configure

Use the visual editor to select the weather entity, set a location label, choose Celsius or Fahrenheit, toggle animation and forecast, and choose how many forecast days to show. The location field is a display label; the actual weather location comes from the selected Home Assistant entity.

The same settings can be configured in YAML:

```yaml
type: custom:weather-glass-card
entity: weather.forecast_home
location: Manama
unit: C # auto, C, or F
show_forecast: true
forecast_days: 4
animated: true
```

| Option | Default | Description |
| --- | --- | --- |
| `entity` | required | Home Assistant weather entity, such as `weather.forecast_home` |
| `location` | `Home` | Display label shown on the card |
| `unit` | `auto` | `auto`, `C`, or `F` |
| `show_forecast` | `true` | Show available daily forecast values |
| `forecast_days` | `4` | Number of forecast days to show (1–7) |
| `animated` | `true` | Animate the weather illustration; reduced-motion preferences are respected |

Forecast display depends on the selected integration exposing forecast data on its weather entity. Current temperature, condition, and available humidity, wind, and apparent temperature use that entity's data.
