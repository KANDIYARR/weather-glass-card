# Weather Glass Card

An animated weather card for Home Assistant dashboards. Weather Glass Card displays current conditions and a multi-day forecast from an existing Home Assistant weather entity, with controls for temperature units, labels, animation, and forecast details.

**Author:** Vinoth Sakthivel · [vinoth@kandiyar.com](mailto:vinoth@kandiyar.com)

## Highlights

- Animated weather artwork that respects reduced-motion preferences
- Celsius, Fahrenheit, or Home Assistant's configured temperature unit
- Optional forecast and current-condition details, when provided by the weather integration
- Visual card editor and YAML configuration
- No API key or additional weather service required
- HACS installation and update support

## Installation

### Install through HACS

1. In Home Assistant, open **HACS** and select the menu in the upper-right corner.
2. Choose **Custom repositories**.
3. Add `https://github.com/KANDIYARR/weather-glass-card` and select **Dashboard** as the category.
4. Select **Add**, open the card in HACS, and choose **Download**.
5. Refresh your dashboard and add **Weather Glass Card** using the card picker.

HACS downloads the card and registers its dashboard resource. Manual file copying and resource configuration are not required. The GitHub repository must be public.

## Configuration

Select a weather entity in the visual editor, or configure the card with YAML:

```yaml
type: custom:weather-glass-card
entity: weather.forecast_home
location: Manama
unit: C
show_forecast: true
forecast_days: 4
animated: true
```

Replace `weather.forecast_home` with a weather entity available in your Home Assistant instance.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `entity` | string | Required | Weather entity that provides current conditions and forecast data |
| `location` | string | `Home` | Display label shown on the card |
| `unit` | string | `auto` | Temperature unit: `auto`, `C`, or `F` |
| `show_forecast` | boolean | `true` | Show the forecast when the entity provides it |
| `forecast_days` | number | `4` | Number of forecast days to display (1–7) |
| `animated` | boolean | `true` | Enable animation for the weather artwork |

## Weather data and units

The selected weather entity determines the actual location and the data available to the card. The `location` option changes only the displayed label. Forecast, humidity, wind, and apparent temperature appear when provided by the entity's integration.

With `unit: auto`, temperatures follow Home Assistant's configured unit system. When reduced motion is enabled in the operating system or browser, the card's animations are disabled.

## Troubleshooting

- **HACS reports that `manifest.json` is missing:** add the repository as a **Dashboard** custom repository. This project is a Lovelace card, not a Home Assistant integration.
- **The forecast is empty:** confirm that the selected weather integration exposes forecast data for its weather entity.
- **The card does not appear after installation:** refresh the browser and confirm that the selected entity exists in Home Assistant.

## Support

When reporting an issue, include your Home Assistant version, the weather integration and entity used, and any relevant browser-console errors.
