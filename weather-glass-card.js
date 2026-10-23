const OPEN_METEO_GEOCODING = 'https://geocoding-api.open-meteo.com/v1/search';
const OPEN_METEO_FORECAST = 'https://api.open-meteo.com/v1/forecast';

class WeatherGlassCard extends HTMLElement {
  static getConfigElement() { return document.createElement('weather-glass-card-editor'); }
  static getStubConfig() { return { source: 'entity', entity: 'weather.forecast_home', location: '', unit: 'auto', show_forecast: true, animated: true, forecast_days: 4 }; }

  setConfig(config) {
    this.config = { source: config.entity ? 'entity' : 'open_meteo', unit: 'auto', show_forecast: true, animated: true, forecast_days: 4, ...config };
    if (this.config.source === 'entity' && !this.config.entity) throw new Error('Choose a Home Assistant weather entity or use location mode.');
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    this._lastFetchKey = null;
    this.updateLocationWeather();
  }

  set hass(hass) {
    this._hass = hass;
    this.updateLocationWeather();
    this.render();
  }

  disconnectedCallback() {
    clearTimeout(this._refreshTimer);
    this._requestController?.abort();
  }

  getCardSize() { return this.config?.show_forecast ? 4 : 3; }

  async updateLocationWeather() {
    if (this.config?.source !== 'open_meteo' || !this._hass || !this.config.location?.trim()) return;
    const key = `${this.config.location.trim()}|${this.config.forecast_days}|${this.targetUnit()}`;
    if (key === this._lastFetchKey && this._weatherStatus === 'loading') return;
    if (key === this._lastFetchKey && this._weatherStatus === 'ready' && Date.now() - (this._lastFetchedAt || 0) < 30 * 60 * 1000) return;
    if (key === this._lastFetchKey && this._weatherStatus === 'error' && Date.now() - (this._lastAttemptAt || 0) < 5 * 60 * 1000) return;
    this._lastFetchKey = key;
    this._lastAttemptAt = Date.now();
    this._weatherStatus = 'loading';
    this._weatherError = '';
    this.render();
    this._requestController?.abort();
    this._requestController = new AbortController();
    const signal = this._requestController.signal;
    try {
      const geoUrl = new URL(OPEN_METEO_GEOCODING);
      geoUrl.search = new URLSearchParams({ name: this.config.location.trim(), count: '1', language: 'en', format: 'json' }).toString();
      const geoResponse = await fetch(geoUrl, { signal });
      if (!geoResponse.ok) throw new Error(`Location search failed (${geoResponse.status}).`);
      const geo = await geoResponse.json();
      const place = geo.results?.[0];
      if (!place) throw new Error(`No matching location found for “${this.config.location.trim()}”. Try adding a region or country.`);

      const unit = this.targetUnit() === '°F' ? 'fahrenheit' : 'celsius';
      const forecastUrl = new URL(OPEN_METEO_FORECAST);
      forecastUrl.search = new URLSearchParams({
        latitude: String(place.latitude), longitude: String(place.longitude),
        current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m',
        daily: 'weather_code,temperature_2m_max,temperature_2m_min',
        forecast_days: String(Math.min(7, Math.max(1, Number(this.config.forecast_days) || 4))),
        temperature_unit: unit, wind_speed_unit: 'kmh', timezone: 'auto'
      }).toString();
      const weatherResponse = await fetch(forecastUrl, { signal });
      if (!weatherResponse.ok) throw new Error(`Weather request failed (${weatherResponse.status}).`);
      const weather = await weatherResponse.json();
      if (!weather.current) throw new Error('Weather data was not available for this location.');
      this._locationWeather = {
        state: this.conditionFromCode(weather.current.weather_code, weather.current.is_day),
        attributes: {
          temperature: weather.current.temperature_2m,
          apparent_temperature: weather.current.apparent_temperature,
          humidity: weather.current.relative_humidity_2m,
          wind_speed: weather.current.wind_speed_10m,
          wind_speed_unit: weather.current_units?.wind_speed_10m || 'km/h',
          temperature_unit: weather.current_units?.temperature_2m || (unit === 'fahrenheit' ? '°F' : '°C'),
          forecast: (weather.daily?.time || []).map((date, i) => ({
            datetime: date,
            condition: this.conditionFromCode(weather.daily.weather_code?.[i], true),
            temperature: weather.daily.temperature_2m_max?.[i],
            templow: weather.daily.temperature_2m_min?.[i]
          }))
        },
        placeName: [place.name, place.admin1, place.country].filter(Boolean).join(', ')
      };
      this._weatherStatus = 'ready';
      this._weatherError = '';
      this._lastFetchedAt = Date.now();
    } catch (error) {
      if (error.name === 'AbortError') return;
      this._weatherStatus = 'error';
      this._weatherError = error.message || 'Unable to load weather for this location.';
    }
    this.render();
    clearTimeout(this._refreshTimer);
    this._refreshTimer = setTimeout(() => {
      this._lastFetchedAt = 0;
      this.updateLocationWeather();
    }, 30 * 60 * 1000);
  }

  targetUnit() {
    const configured = this.config?.unit;
    if (configured === 'F') return '°F';
    if (configured === 'C') return '°C';
    return this._hass?.config?.unit_system?.temperature || '°C';
  }

  render() {
    if (!this._hass || !this.config) return;
    if (this.config.source === 'open_meteo') {
      if (!this.config.location?.trim()) {
        this.showMessage('Enter a city or location in the card settings.');
        return;
      }
      if (this._weatherStatus === 'loading' || !this._locationWeather) {
        this.showMessage(`Loading weather for ${this.config.location.trim()}…`);
        return;
      }
      if (this._weatherStatus === 'error') {
        this.showMessage(this._weatherError || 'Unable to load weather for this location.');
        return;
      }
    }
    const state = this.config.source === 'open_meteo' ? this._locationWeather : this._hass.states[this.config.entity];
    if (!state) {
      this.showMessage(`Weather entity “${this.config.entity}” was not found.`);
      return;
    }
    const attrs = state.attributes || {};
    const unit = this.targetUnit();
    const sourceUnit = this.config.source === 'open_meteo' ? (attrs.temperature_unit || unit) : (this._hass.config?.unit_system?.temperature || '°C');
    const convert = value => {
      const n = Number(value);
      if (!Number.isFinite(n)) return '—';
      const c = sourceUnit.includes('F') ? (n - 32) * 5 / 9 : n;
      return Math.round(unit.includes('F') ? c * 9 / 5 + 32 : c);
    };
    const condition = String(state.state || 'unknown').replaceAll('_', ' ');
    const icon = this.iconFor(state.state);
    const forecast = attrs.forecast || [];
    const days = forecast.slice(0, Number(this.config.forecast_days || 4)).map((day, i) => {
      const date = day.datetime ? new Date(day.datetime) : null;
      const label = i === 0 ? 'Today' : date ? new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date) : `Day ${i + 1}`;
      const high = day.temperature ?? day.temperature_2m_max;
      const low = day.templow ?? day.temperature_2m_min;
      return `<div class="day"><span>${label}</span><span class="mini">${this.iconFor(day.condition)}</span><b>${convert(high)}°${low != null ? ` <span class="low">${convert(low)}°</span>` : ''}</b></div>`;
    }).join('');
    const feels = attrs.apparent_temperature ?? attrs.feels_like;
    const humidity = attrs.humidity;
    const wind = attrs.wind_speed;
    const details = [
      feels != null ? `<div><span>Feels like</span><b>${convert(feels)}${unit}</b></div>` : '',
      humidity != null ? `<div><span>Humidity</span><b>${Math.round(humidity)}%</b></div>` : '',
      wind != null ? `<div><span>Wind</span><b>${this.escape(wind)} ${this.escape(attrs.wind_speed_unit || '')}</b></div>` : ''
    ].join('');
    const place = this.config.source === 'open_meteo'
      ? (this.config.location_label || this._locationWeather.placeName || this.config.location)
      : (this.config.location_label || this.config.location || attrs.friendly_name || 'Weather');
    this.shadowRoot.innerHTML = `
      <style>
        :host{display:block;--ink:var(--primary-text-color,#f4f7ff);--muted:var(--secondary-text-color,#bac7dc);--accent:var(--weather-glass-accent,#a8d8ff)}
        ha-card{position:relative;overflow:hidden;border-radius:26px;padding:22px 24px 18px;color:var(--ink);background:linear-gradient(135deg,rgba(24,42,70,.96),rgba(34,61,91,.88));border:1px solid rgba(255,255,255,.14);box-shadow:0 18px 46px rgba(4,17,35,.25)}
        .glow{position:absolute;width:230px;height:230px;border-radius:50%;right:-72px;top:-102px;background:radial-gradient(circle,rgba(103,184,255,.28),transparent 68%);pointer-events:none}
        .top,.main,.details,.forecast{position:relative;z-index:1}.top{display:flex;justify-content:space-between;align-items:center;color:var(--muted);font-size:13px;letter-spacing:.03em}.place{font-size:15px;font-weight:650;color:var(--ink)}
        .main{display:flex;align-items:center;justify-content:space-between;min-height:132px}.reading{display:flex;align-items:flex-start;gap:5px}.temp{font-size:78px;line-height:1;font-weight:300;letter-spacing:-.08em}.unit{font-size:22px;padding-top:9px;color:var(--muted)}.condition{color:var(--muted);text-transform:capitalize;font-size:15px;margin-top:10px}.art{font-size:76px;filter:drop-shadow(0 8px 16px rgba(120,190,255,.24));margin-right:10px}
        .details{display:flex;gap:0;border-top:1px solid rgba(255,255,255,.12);padding:13px 0 12px}.details>div{flex:1;display:flex;flex-direction:column;gap:5px}.details>div+div{border-left:1px solid rgba(255,255,255,.12);padding-left:16px}.details span{font-size:11px;color:var(--muted)}.details b{font-size:13px;font-weight:600}
        .forecast{display:flex;justify-content:space-between;gap:8px;border-top:1px solid rgba(255,255,255,.12);padding-top:12px}.day{display:flex;flex-direction:column;align-items:center;gap:6px;color:var(--muted);font-size:11px;min-width:40px}.day b{color:var(--ink);font-size:13px}.day .low{color:var(--muted);font-weight:400}.mini{font-size:20px;line-height:1.1}.credit{display:block;position:relative;z-index:1;text-align:right;padding-top:8px;color:var(--muted);font-size:10px}.credit a{color:inherit;text-decoration:none}.error{padding:20px;color:var(--ink)}
        :host([animated]) .art{animation:float 4s ease-in-out infinite}:host([animated]) .glow{animation:breathe 6s ease-in-out infinite}@keyframes float{50%{transform:translateY(-7px)}}@keyframes breathe{50%{opacity:.55;transform:scale(1.08)}}
        @media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;scroll-behavior:auto!important}}
      </style>
      <ha-card><div class="glow"></div><div class="top"><span class="place">${this.escape(place)}</span><span>${new Intl.DateTimeFormat(undefined,{weekday:'long'}).format(new Date())}</span></div>
      <div class="main"><div><div class="reading"><span class="temp">${convert(attrs.temperature)}</span><span class="unit">${unit}</span></div><div class="condition">${this.escape(condition)}</div></div><div class="art" aria-hidden="true">${icon}</div></div>
      ${details ? `<div class="details">${details}</div>` : ''}${this.config.show_forecast && days ? `<div class="forecast">${days}</div>` : ''}${this.config.source === 'open_meteo' ? '<a class="credit" href="https://open-meteo.com/" target="_blank" rel="noreferrer">Weather data by Open-Meteo</a>' : ''}</ha-card>`;
    this.toggleAttribute('animated', this.config.animated !== false);
  }

  showMessage(message) {
    this.shadowRoot.innerHTML = `<style>:host{display:block;color:var(--primary-text-color,#f4f7ff)}ha-card{border-radius:20px;padding:20px;background:var(--ha-card-background,var(--card-background-color,#fff))}.error{font-size:14px}</style><ha-card><div class="error">${this.escape(message)}</div></ha-card>`;
  }

  conditionFromCode(code, isDay = true) {
    const n = Number(code);
    if (n === 0) return isDay ? 'sunny' : 'clear-night';
    if (n === 1) return 'mostly clear';
    if (n === 2) return 'partly cloudy';
    if (n === 3) return 'cloudy';
    if ([45, 48].includes(n)) return 'fog';
    if ([51, 53, 55].includes(n)) return 'drizzle';
    if ([56, 57].includes(n)) return 'freezing drizzle';
    if ([61, 63, 65].includes(n)) return 'rainy';
    if ([66, 67].includes(n)) return 'freezing rain';
    if ([71, 73, 75, 77].includes(n)) return 'snowy';
    if ([80, 81, 82].includes(n)) return 'pouring';
    if ([85, 86].includes(n)) return 'snowy';
    if ([95, 96, 99].includes(n)) return 'lightning';
    return 'unknown';
  }

  iconFor(condition) {
    const c = String(condition || '').toLowerCase();
    if (/lightning|thunder/.test(c)) return '⛈️';
    if (/snow|hail|sleet/.test(c)) return '🌨️';
    if (/rain|pour|drizzle/.test(c)) return '🌧️';
    if (/fog|mist|haze/.test(c)) return '🌫️';
    if (/wind/.test(c)) return '💨';
    if (/cloudy|overcast/.test(c)) return '☁️';
    if (/partly|mostly clear/.test(c)) return '⛅';
    if (/clear-night/.test(c)) return '🌙';
    if (/clear|sunny/.test(c)) return '☀️';
    return '🌤️';
  }

  escape(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
}

class WeatherGlassCardEditor extends HTMLElement {
  setConfig(config) { this._config = { source: config.entity ? 'entity' : 'open_meteo', ...config }; this.render(); }
  set hass(hass) { this._hass = hass; this.render(); }

  render() {
    if (!this._config) return;
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const entities = Object.entries(this._hass?.states || {}).filter(([id]) => id.startsWith('weather.'));
    const selected = this._config.entity || '';
    const options = entities.map(([id, entity]) => `<option value="${esc(id)}" ${id === selected ? 'selected' : ''}>${esc(entity.attributes?.friendly_name || id)} (${esc(id)})</option>`).join('');
    this.innerHTML = `<div style="display:grid;gap:12px;padding:12px 0">
      <label>Weather source<br><select data-key="source"><option value="open_meteo">Search by location</option><option value="entity">Home Assistant weather entity</option></select></label>
      <label data-show="open_meteo">City, region, or country<br><input data-key="location" placeholder="Manama, Bahrain" value="${esc(this._config.location)}"></label>
      <label data-show="entity">Weather entity<br><select data-key="entity"><option value="">Select an entity</option>${options}</select></label>
      <label>Card title (optional)<br><input data-key="location_label" placeholder="Use place name" value="${esc(this._config.location_label)}"></label>
      <label>Temperature unit<br><select data-key="unit"><option value="auto">Home Assistant default</option><option value="C">Celsius</option><option value="F">Fahrenheit</option></select></label>
      <label>Forecast days<br><input data-key="forecast_days" type="number" min="1" max="7" value="${Number(this._config.forecast_days) || 4}"></label>
      <label><input data-key="show_forecast" type="checkbox" ${this._config.show_forecast !== false ? 'checked' : ''}> Show forecast</label>
      <label><input data-key="animated" type="checkbox" ${this._config.animated !== false ? 'checked' : ''}> Animate weather art</label></div>`;
    this.querySelector('[data-key="source"]').value = this._config.source || 'open_meteo';
    this.querySelector('[data-key="unit"]').value = this._config.unit || 'auto';
    this.updateVisibility();
    this.querySelectorAll('input,select').forEach(el => el.addEventListener('change', () => {
      const key = el.dataset.key;
      this._config[key] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : el.value;
      if (key === 'source') this.updateVisibility();
      this.dispatchEvent(new Event('config-changed', { bubbles: true, composed: true, detail: { config: { ...this._config } } }));
    }));
  }

  updateVisibility() {
    this.querySelectorAll('[data-show]').forEach(el => { el.style.display = el.dataset.show === this._config.source ? 'block' : 'none'; });
  }
}

customElements.define('weather-glass-card', WeatherGlassCard);
customElements.define('weather-glass-card-editor', WeatherGlassCardEditor);
window.customCards = window.customCards || [];
window.customCards.push({ type: 'weather-glass-card', name: 'Weather Glass Card', description: 'Animated weather card with location search or Home Assistant weather entities.', preview: true });
