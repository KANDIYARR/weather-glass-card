class WeatherGlassCard extends HTMLElement {
  static getConfigElement() { return document.createElement('weather-glass-card-editor'); }
  static getStubConfig() { return { entity: 'weather.forecast_home', location: 'Home', unit: 'auto', show_forecast: true, animated: true }; }

  setConfig(config) {
    if (!config.entity) throw new Error('Please provide a weather entity.');
    this.config = { location: 'Home', unit: 'auto', show_forecast: true, animated: true, ...config };
    this.attachShadow({ mode: 'open' });
  }

  set hass(hass) { this._hass = hass; this.render(); }
  getCardSize() { return this.config?.show_forecast ? 4 : 3; }

  render() {
    if (!this._hass || !this.config) return;
    const state = this._hass.states[this.config.entity];
    if (!state) {
      this.shadowRoot.innerHTML = `<ha-card><div class="error">Weather entity “${this.config.entity}” was not found.</div></ha-card>`;
      return;
    }
    const attrs = state.attributes || {};
    const systemUnit = this._hass.config?.unit_system?.temperature || '°C';
    const unit = this.config.unit === 'auto' ? systemUnit : this.config.unit === 'F' ? '°F' : '°C';
    const convert = value => {
      const n = Number(value);
      if (!Number.isFinite(n)) return '—';
      const c = systemUnit.includes('F') ? (n - 32) * 5 / 9 : n;
      return Math.round(this.config.unit === 'auto' ? n : unit === '°F' ? c * 9 / 5 + 32 : c);
    };
    const condition = String(state.state || 'unknown').replaceAll('_', ' ');
    const icon = this.iconFor(state.state);
    const forecast = attrs.forecast || [];
    const days = forecast.slice(0, Number(this.config.forecast_days || 4)).map((day, i) => {
      const date = day.datetime ? new Date(day.datetime) : null;
      const label = i === 0 ? 'Today' : date ? new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date) : `Day ${i + 1}`;
      return `<div class="day"><span>${label}</span><span class="mini">${this.iconFor(day.condition)}</span><b>${convert(day.temperature)}°</b></div>`;
    }).join('');
    const feels = attrs.apparent_temperature ?? attrs.feels_like;
    const humidity = attrs.humidity;
    const wind = attrs.wind_speed;
    const details = [
      feels != null ? `<div><span>Feels like</span><b>${convert(feels)}${unit}</b></div>` : '',
      humidity != null ? `<div><span>Humidity</span><b>${Math.round(humidity)}%</b></div>` : '',
      wind != null ? `<div><span>Wind</span><b>${wind} ${attrs.wind_speed_unit || ''}</b></div>` : ''
    ].join('');
    this.shadowRoot.innerHTML = `
      <style>
        :host{display:block;--ink:var(--primary-text-color,#f4f7ff);--muted:var(--secondary-text-color,#bac7dc);--accent:var(--weather-glass-accent,#a8d8ff)}
        ha-card{position:relative;overflow:hidden;border-radius:26px;padding:22px 24px 18px;color:var(--ink);background:linear-gradient(135deg,rgba(24,42,70,.96),rgba(34,61,91,.88));border:1px solid rgba(255,255,255,.14);box-shadow:0 18px 46px rgba(4,17,35,.25)}
        .glow{position:absolute;width:230px;height:230px;border-radius:50%;right:-72px;top:-102px;background:radial-gradient(circle,rgba(103,184,255,.28),transparent 68%);pointer-events:none}
        .top,.main,.details,.forecast{position:relative;z-index:1}.top{display:flex;justify-content:space-between;align-items:center;color:var(--muted);font-size:13px;letter-spacing:.03em}.place{font-size:15px;font-weight:650;color:var(--ink)}
        .main{display:flex;align-items:center;justify-content:space-between;min-height:132px}.reading{display:flex;align-items:flex-start;gap:5px}.temp{font-size:78px;line-height:1;font-weight:300;letter-spacing:-.08em}.unit{font-size:22px;padding-top:9px;color:var(--muted)}.condition{color:var(--muted);text-transform:capitalize;font-size:15px;margin-top:10px}.art{font-size:76px;filter:drop-shadow(0 8px 16px rgba(120,190,255,.24));margin-right:10px}
        .details{display:flex;gap:0;border-top:1px solid rgba(255,255,255,.12);padding:13px 0 12px}.details>div{flex:1;display:flex;flex-direction:column;gap:5px}.details>div+div{border-left:1px solid rgba(255,255,255,.12);padding-left:16px}.details span{font-size:11px;color:var(--muted)}.details b{font-size:13px;font-weight:600}
        .forecast{display:flex;justify-content:space-between;gap:8px;border-top:1px solid rgba(255,255,255,.12);padding-top:12px}.day{display:flex;flex-direction:column;align-items:center;gap:6px;color:var(--muted);font-size:11px;min-width:40px}.day b{color:var(--ink);font-size:13px}.mini{font-size:20px;line-height:1.1}.error{padding:20px;color:var(--ink)}
        :host([animated]) .art{animation:float 4s ease-in-out infinite}:host([animated]) .glow{animation:breathe 6s ease-in-out infinite}@keyframes float{50%{transform:translateY(-7px)}}@keyframes breathe{50%{opacity:.55;transform:scale(1.08)}}
        @media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;scroll-behavior:auto!important}}
      </style>
      <ha-card><div class="glow"></div><div class="top"><span class="place">${this.escape(this.config.location || attrs.friendly_name || 'Weather')}</span><span>${new Intl.DateTimeFormat(undefined,{weekday:'long'}).format(new Date())}</span></div>
      <div class="main"><div><div class="reading"><span class="temp">${convert(attrs.temperature)}</span><span class="unit">${unit}</span></div><div class="condition">${this.escape(condition)}</div></div><div class="art" aria-hidden="true">${icon}</div></div>
      ${details ? `<div class="details">${details}</div>` : ''}${this.config.show_forecast && days ? `<div class="forecast">${days}</div>` : ''}</ha-card>`;
    this.toggleAttribute('animated', this.config.animated !== false);
  }

  iconFor(condition) {
    const c = String(condition || '').toLowerCase();
    if (/lightning|thunder/.test(c)) return '⛈️';
    if (/snow|hail|sleet/.test(c)) return '🌨️';
    if (/rain|pour/.test(c)) return '🌧️';
    if (/fog|mist|haze/.test(c)) return '🌫️';
    if (/wind/.test(c)) return '💨';
    if (/cloudy|overcast/.test(c)) return '☁️';
    if (/partly/.test(c)) return '⛅';
    if (/clear|sunny/.test(c)) return '☀️';
    return '🌤️';
  }
  escape(value) { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
}

class WeatherGlassCardEditor extends HTMLElement {
  setConfig(config) { this._config = { ...config }; this.render(); }
  set hass(hass) { this._hass = hass; }
  render() {
    if (!this._config) return;
    this.innerHTML = `<div style="display:grid;gap:12px;padding:12px 0"><label>Weather entity<br><input data-key="entity" placeholder="weather.forecast_home" value="${this._config.entity || ''}"></label><label>Location label<br><input data-key="location" placeholder="Home" value="${this._config.location || ''}"></label><label>Temperature unit<br><select data-key="unit"><option value="auto">Home Assistant default</option><option value="C">Celsius</option><option value="F">Fahrenheit</option></select></label><label>Forecast days<br><input data-key="forecast_days" type="number" min="1" max="7" value="${this._config.forecast_days || 4}"></label><label><input data-key="show_forecast" type="checkbox" ${this._config.show_forecast !== false ? 'checked' : ''}> Show forecast</label><label><input data-key="animated" type="checkbox" ${this._config.animated !== false ? 'checked' : ''}> Animate weather art</label></div>`;
    this.querySelector('[data-key="unit"]').value = this._config.unit || 'auto';
    this.querySelectorAll('input,select').forEach(el => el.addEventListener('change', () => {
      const key = el.dataset.key;
      this._config[key] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : el.value;
      this.dispatchEvent(new Event('config-changed', { bubbles: true, composed: true, detail: { config: this._config } }));
    }));
  }
}

customElements.define('weather-glass-card', WeatherGlassCard);
customElements.define('weather-glass-card-editor', WeatherGlassCardEditor);
window.customCards = window.customCards || [];
window.customCards.push({ type: 'weather-glass-card', name: 'Weather Glass Card', description: 'Animated, configurable weather card for Home Assistant.', preview: true });
