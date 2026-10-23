# Weather Glass Card

A responsive, animated Lovelace weather card for Home Assistant. The design pairs a large, lightweight temperature and drawn SVG condition icon with compact humidity and wind tiles. The background and canvas animation adapt to the current weather.

**Author:** Vinoth Sakthivel · [vinoth@kandiyar.com](mailto:vinoth@kandiyar.com)

## Install

1. Copy `weather-glass-card.js` to your Home Assistant configuration's `www` folder as `/config/www/weather-glass-card.js`.
2. In Home Assistant, open **Settings → Dashboards → ⋮ → Resources** and select **Add resource**.
3. Enter `/local/weather-glass-card.js` and choose **JavaScript module** as the resource type.
4. Save, then hard-refresh the Home Assistant page. On most browsers use **Ctrl+Shift+R**; on macOS use **Cmd+Shift+R**.
5. Add a **Weather Glass Card** to a dashboard and select a `weather.*` entity.

## Example

```yaml
type: custom:weather-glass-card
entity: weather.forecast_home
name: Manama
show_humidity: true
show_wind: true
show_forecast: false
animation: true
temperature_unit: auto
```

`temperature_unit: auto` uses the entity's temperature unit. Set it to `°C` or `°F` to override the display unit.

| Option | Default | Description |
| --- | --- | --- |
| `entity` | Required | Home Assistant weather entity, such as `weather.forecast_home` |
| `name` | Entity name | Optional location name shown on the card |
| `show_humidity` | `true` | Show the humidity tile when the entity provides humidity |
| `show_wind` | `true` | Show the wind tile when the entity provides wind speed |
| `show_forecast` | `false` | Request and show a compact five-day forecast |
| `animation` | `true` | Animate the weather background; animation pauses off-screen and respects reduced-motion preferences |
| `temperature_unit` | `auto` | Use the entity's unit (`auto`) or select `°C` or `°F` |

## Preview weather conditions

For a quick visual check, open **Developer Tools → States**, select your weather entity, and temporarily set its state to one of these conditions:

`sunny`, `partlycloudy`, `cloudy`, `rainy`, `pouring`, `lightning`, `lightning-rainy`, `snowy`, `snowy-rainy`, `clear-night`, `fog`, `windy`, `windy-variant`, `hail`, or `exceptional`.

The entity's existing temperature, humidity, and wind attributes remain in use. A real integration may overwrite a temporary state change on its next update. For a persistent demo, create a template weather entity with a selectable condition and sample values.

## Notes

- Forecasts are requested with Home Assistant's `weather.get_forecasts` action and appear only when the selected entity provides daily forecasts.
- Rain, storm, snow, cloud, sun, night, fog, wind, and hail effects are drawn on a small canvas. The card caps canvas resolution at 2× device pixel ratio and pauses rendering while off-screen or while the browser tab is hidden.
- If the entity is `unknown`, `unavailable`, or has no temperature, the card displays **Weather unavailable**.
