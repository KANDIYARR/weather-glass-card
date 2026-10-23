# Weather Glass Card

A polished, animated weather card for Home Assistant dashboards. Weather Glass Card displays current conditions and a multi-day forecast from a Home Assistant `weather` entity, with configurable units, location label, and display options.

**Author:** Vinoth Sakthivel · [vinoth@kandiyar.com](mailto:vinoth@kandiyar.com)

## Features

- Animated weather illustration with reduced-motion support
- Celsius, Fahrenheit, or Home Assistant default units
- Configurable location label and forecast length
- Optional humidity, wind, and feels-like details when provided by the weather integration
- Visual editor and YAML configuration
- No API key or external weather service required
- HACS installation and updates

## Installation

### Install with HACS

1. In Home Assistant, open **HACS** and select the menu in the upper-right corner.
2. Choose **Custom repositories**.
3. Enter `https://github.com/KANDIYARR/weather-glass-card` and select **Dashboard** as the category.
4. Select **Add**, find **Weather Glass Card** in HACS, and choose **Download**.
5. Refresh the Home Assistant dashboard, then add **Weather Glass Card** using the card picker.

HACS installs the JavaScript file and registers the dashboard resource. You do not need to copy files or add the resource manually. The repository must be public on GitHub.

## Configuration

Use the visual editor to select a weather entity and configure the card. To configure it in YAML, use:

```yaml
type: custom:weather-glass-card
entity: weather.forecast_home
location: Manama
unit: C
show_forecast: true
forecast_days: 4
animated: true
```

Replace `weather.forecast_home` with a weather entity in your Home Assistant instance.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `entity` | string | Required | Weather entity used for current conditions and forecast |
| `location` | string | `Home` | Label displayed at the top of the card |
| `unit` | string | `auto` | Temperature unit: `auto`, `C`, or `F` |
| `show_forecast` | boolean | `true` | Show forecast when the entity provides it |
| `forecast_days` | number | `4` | Forecast days to display, from 1 to 7 |
| `animated` | boolean | `true` | Animate the weather illustration |

## Data and units

The selected entity determines the actual weather location and available data. The `location` option changes only the card's display label. Forecast, humidity, wind, and apparent temperature are shown when the entity's integration provides them.

With `unit: auto`, temperatures follow Home Assistant's configured unit system. The card supports reduced-motion preferences by disabling its animations when requested by the operating system or browser.

## Support

If you encounter a problem, include your Home Assistant version, the weather entity's integration, and the relevant browser console error when opening an issue.
