# Weather Glass Card

An animated, configurable Home Assistant Lovelace weather card. It reads current conditions and forecast from an existing `weather.*` entity, so no API key or external service is needed.

## Install

1. Copy `weather-glass-card.js` to `/config/www/weather-glass-card.js`.
2. In Home Assistant, open **Settings → Dashboards → Resources**, add `/local/weather-glass-card.js` as a JavaScript module, then refresh the browser.
3. Add a **Weather Glass Card** from the visual card picker, or use YAML:

```yaml
type: custom:weather-glass-card
entity: weather.forecast_home
location: Manama
unit: C # auto, C, or F
show_forecast: true
forecast_days: 4
animated: true
```

Replace `weather.forecast_home` with a weather entity available in your Home Assistant installation. You can also select the entity, label, units, forecast length, and animation in the card editor. The Home Assistant unit system is used when `unit: auto`.

## Options

| Option | Default | Description |
| --- | --- | --- |
| `entity` | required | Home Assistant weather entity, such as `weather.forecast_home` |
| `location` | `Home` | Display label; it does not change the weather entity's actual location |
| `unit` | `auto` | `auto`, `C`, or `F` |
| `show_forecast` | `true` | Show available daily forecast values |
| `forecast_days` | `4` | Number of forecast rows to show (1–7) |
| `animated` | `true` | Animate the weather illustration; reduced-motion preferences are respected |

Forecast display depends on the selected integration exposing forecast data on the weather entity. Current temperature, condition, and optional humidity/wind/apparent temperature use the entity's attributes.
