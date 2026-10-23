class WeatherGlassCard extends HTMLElement {
  static getConfigElement() { return document.createElement('weather-glass-card-editor'); }

  static getStubConfig() {
    return {
      entity: 'weather.forecast_home',
      show_humidity: true,
      show_wind: true,
      show_forecast: false,
      animation: true,
    };
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._forecast = [];
    this._forecastFetchedAt = 0;
    this._forecastPromise = null;
    this._visible = true;
    this._raf = 0;
    this._build();
    this._onVisibilityChange = () => this._syncAnimation();
    this._onMotionChange = () => {
      this._reducedMotion = Boolean(this._motionQuery?.matches);
      this._syncAnimation();
    };
  }

  setConfig(config) {
    if (!config?.entity || !/^weather\.[a-z0-9_]+$/i.test(config.entity)) {
      throw new Error('Set entity to a Home Assistant weather entity, for example weather.forecast_home.');
    }
    const previousEntity = this.config?.entity;
    this.config = {
      show_humidity: true,
      show_wind: true,
      show_forecast: false,
      animation: true,
      temperature_unit: 'auto',
      ...config,
    };
    if (previousEntity !== this.config.entity) {
      this._forecast = [];
      this._forecastFetchedAt = 0;
    }
    this._updateCard();
    this._requestForecast(true);
    this._syncAnimation();
  }

  set hass(hass) {
    this._hass = hass;
    this._updateCard();
    this._requestForecast(false);
  }

  getCardSize() {
    return this.config?.show_forecast ? 4 : 3;
  }

  connectedCallback() {
    document.addEventListener('visibilitychange', this._onVisibilityChange);
    this._motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    this._reducedMotion = Boolean(this._motionQuery?.matches);
    this._motionQuery?.addEventListener?.('change', this._onMotionChange);
    if ('IntersectionObserver' in window) {
      this._intersectionObserver = new IntersectionObserver(entries => {
        this._visible = entries[0]?.isIntersecting ?? true;
        this._syncAnimation();
      }, { threshold: 0.01 });
      this._intersectionObserver.observe(this);
    }
    if ('ResizeObserver' in window) {
      this._resizeObserver = new ResizeObserver(() => this._resizeCanvas());
      this._resizeObserver.observe(this);
    }
    this._resizeCanvas();
    this._syncAnimation();
    this._requestForecast(false);
  }

  disconnectedCallback() {
    document.removeEventListener('visibilitychange', this._onVisibilityChange);
    this._motionQuery?.removeEventListener?.('change', this._onMotionChange);
    this._intersectionObserver?.disconnect();
    this._resizeObserver?.disconnect();
    this._stopAnimation();
  }

  _build() {
    this.shadowRoot.innerHTML = `
      <style>
        :host{display:block;color:#f7f9ff;font-family:var(--primary-font-family,Roboto,"Helvetica Neue",Arial,sans-serif);}
        *{box-sizing:border-box}
        .card{--sky-1:#183858;--sky-2:#10233f;position:relative;isolation:isolate;overflow:hidden;min-height:440px;padding:clamp(22px,4vw,42px);border:1px solid rgba(255,255,255,.2);border-radius:var(--ha-card-border-radius,32px);background:linear-gradient(155deg,var(--sky-1),var(--sky-2));box-shadow:0 18px 48px rgba(6,19,39,.24);}
        .card[data-weather="sunny"]{--sky-1:#206b9f;--sky-2:#124777}
        .card[data-weather="partlycloudy"]{--sky-1:#4c7897;--sky-2:#203e5c}
        .card[data-weather="cloudy"]{--sky-1:#55718c;--sky-2:#263d55}
        .card[data-weather="rainy"],.card[data-weather="pouring"]{--sky-1:#294b73;--sky-2:#10213e}
        .card[data-weather="lightning"],.card[data-weather="lightning-rainy"]{--sky-1:#38345f;--sky-2:#14162d}
        .card[data-weather="snowy"],.card[data-weather="snowy-rainy"]{--sky-1:#4d6c88;--sky-2:#263c58}
        .card[data-weather="clear-night"]{--sky-1:#292b59;--sky-2:#101329}
        .card[data-weather="fog"]{--sky-1:#4c6678;--sky-2:#344a5a}
        .card[data-weather="windy"],.card[data-weather="windy-variant"]{--sky-1:#327186;--sky-2:#173b52}
        .card[data-weather="hail"]{--sky-1:#456783;--sky-2:#1e344b}
        .card[data-weather="exceptional"]{--sky-1:#5d526c;--sky-2:#28243a}
        canvas{position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none}
        .wash{position:absolute;inset:0;z-index:0;background:linear-gradient(145deg,rgba(255,255,255,.035),transparent 46%,rgba(4,15,34,.16));pointer-events:none}
        .content,.message{position:relative;z-index:1}
        .top{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:42px}
        .name{display:flex;align-items:center;gap:12px;min-width:0;font-size:clamp(19px,3vw,27px);font-weight:700;letter-spacing:.01em;text-shadow:0 1px 8px rgba(0,0,0,.16)}.pin-icon{width:25px;height:25px;flex:none}.pin-icon svg,.tile-icon svg{width:100%;height:100%;display:block}
        .name-text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .day{flex:none;padding:9px 20px;border:1px solid rgba(255,255,255,.18);border-radius:999px;background:rgba(5,18,42,.28);font-size:clamp(14px,2.4vw,18px);font-weight:650;}
        .hero{position:relative;display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:250px;padding:14px 0 4px}
        .reading{position:relative;z-index:1;min-width:0}
        .temperature-line{display:flex;align-items:flex-start;gap:9px;white-space:nowrap}
        .temperature{font-size:clamp(88px,17vw,154px);font-weight:200;line-height:.93;letter-spacing:-.085em;font-variant-numeric:tabular-nums;text-shadow:0 4px 22px rgba(0,0,0,.1)}
        .temperature-unit{padding-top:12px;font-size:clamp(22px,4vw,40px);font-weight:300;opacity:.94}
        .condition{margin-top:19px;font-size:clamp(20px,3.4vw,30px);font-weight:400;letter-spacing:.015em;text-shadow:0 2px 10px rgba(0,0,0,.15)}
        .weather-icon{flex:none;width:clamp(112px,25vw,206px);height:clamp(112px,25vw,206px);filter:drop-shadow(0 8px 18px rgba(0,0,0,.15));}
        .details{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:10px}
        .tile{min-width:0;padding:clamp(15px,3vw,24px);border:1px solid rgba(255,255,255,.18);border-radius:26px;background:rgba(5,18,42,.3);box-shadow:inset 0 1px 0 rgba(255,255,255,.08);backdrop-filter:blur(8px)}
        .tile-head{display:flex;align-items:center;gap:10px;font-size:clamp(14px,2.7vw,19px);font-weight:650;color:#f7f9ff}
        .tile-icon{width:22px;height:22px;flex:none;color:#eaf4ff}
        .tile-value{margin-top:18px;font-size:clamp(25px,5vw,39px);font-weight:700;line-height:1.1;font-variant-numeric:tabular-nums;color:#fff}
        .tile-unit{font-size:.55em;font-weight:600;letter-spacing:0;opacity:.96}
        .meter{height:8px;margin-top:17px;overflow:hidden;border-radius:99px;background:rgba(222,237,255,.28)}
        .meter-fill{height:100%;width:0;border-radius:inherit;background:#ffd068;box-shadow:0 0 10px rgba(255,208,104,.25);transition:width .35s ease}
        .forecast{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px;margin-top:18px;padding-top:16px;border-top:1px solid rgba(255,255,255,.2)}
        .forecast[hidden],.tile[hidden],.details[hidden]{display:none!important}
        .forecast-day{display:flex;flex-direction:column;align-items:center;gap:6px;min-width:0;text-align:center;color:#f5f8ff}
        .forecast-label{font-size:12px;font-weight:600}
        .forecast-icon{width:31px;height:31px}
        .forecast-temp{font-size:13px;font-weight:700;white-space:nowrap}
        .forecast-low{font-weight:400;color:#e3edf8;margin-left:3px}
        .message{display:none;padding:24px 18px;text-align:center;font-size:15px;font-weight:600;color:#fff}
        .card[data-message="true"] .content{display:none}.card[data-message="true"] .message{display:block}
        @media(max-width:520px){.card{min-height:0;padding:20px;border-radius:var(--ha-card-border-radius,26px)}.hero{min-height:195px}.temperature{font-size:clamp(82px,19vw,116px)}.weather-icon{width:clamp(92px,26vw,132px);height:clamp(92px,26vw,132px)}.details{gap:10px}.tile{padding:15px;border-radius:21px}.tile-value{margin-top:14px}.meter{margin-top:13px}.forecast{gap:2px}.forecast-label{font-size:11px}}
        @media(max-width:360px){.card{padding:17px}.hero{min-height:165px}.temperature{font-size:76px}.weather-icon{width:84px;height:84px}.tile{padding:12px}.tile-head{gap:6px;font-size:13px}}
        @media(prefers-reduced-motion:reduce){.meter-fill{transition:none}}
      </style>
      <article class="card" data-weather="unknown" data-message="false">
        <canvas aria-hidden="true"></canvas><div class="wash" aria-hidden="true"></div>
        <div class="message" role="status"></div>
        <div class="content">
          <header class="top"><div class="name"><span class="pin-icon" aria-hidden="true"></span><span class="name-text"></span></div><div class="day"></div></header>
          <section class="hero"><div class="reading"><div class="temperature-line"><span class="temperature"></span><span class="temperature-unit"></span></div><div class="condition"></div></div><div class="weather-icon"></div></section>
          <section class="details" aria-label="Current weather details">
            <div class="tile humidity-tile"><div class="tile-head"><span class="humidity-icon tile-icon"></span><span>Humidity</span></div><div class="tile-value humidity-value"></div><div class="meter" role="meter" aria-label="Humidity" aria-valuemin="0" aria-valuemax="100"><div class="meter-fill humidity-fill"></div></div></div>
            <div class="tile wind-tile"><div class="tile-head"><span class="wind-icon tile-icon"></span><span>Wind</span></div><div class="tile-value wind-value"></div><div class="meter" role="meter" aria-label="Wind speed relative to 120 kilometers per hour"><div class="meter-fill wind-fill"></div></div></div>
          </section>
          <section class="forecast" aria-label="Five-day forecast" hidden></section>
        </div>
      </article>`;
    this._el = Object.fromEntries(['card','canvas','message','name','day','temperature','temperatureUnit','condition','icon','details','humidityTile','humidityValue','humidityFill','humidityMeter','windTile','windValue','windFill','windMeter','forecast'].map(key => [key, this.shadowRoot.querySelector({
      card: '.card', canvas: 'canvas', message: '.message', name: '.name-text', day: '.day', temperature: '.temperature', temperatureUnit: '.temperature-unit', condition: '.condition', icon: '.weather-icon', details: '.details', humidityTile: '.humidity-tile', humidityValue: '.humidity-value', humidityFill: '.humidity-fill', humidityMeter: '.humidity-tile .meter', windTile: '.wind-tile', windValue: '.wind-value', windFill: '.wind-fill', windMeter: '.wind-tile .meter', forecast: '.forecast'
    }[key])]));
    this._ctx = this._el.canvas.getContext('2d', { alpha: true });
    this.shadowRoot.querySelector('.pin-icon').innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 10c0 5-7 12-7 12S5 15 5 10a7 7 0 1 1 14 0Z" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="10" r="2.2" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
    this.shadowRoot.querySelector('.humidity-icon').innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3C9 8 5.8 11 5.8 15.1a6.2 6.2 0 0 0 12.4 0C18.2 11 15 8 12 3Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
    this.shadowRoot.querySelector('.wind-icon').innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8h12a3 3 0 1 0-3-3M2 12h17a2.5 2.5 0 1 1-2.5 2.5M4 16h9a2 2 0 1 1-2 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  }

  _updateCard() {
    if (!this.config || !this._hass) return;
    const entity = this._hass.states?.[this.config.entity];
    if (!entity || ['unavailable','unknown'].includes(entity.state) || entity.attributes?.temperature == null || !Number.isFinite(Number(entity.attributes.temperature))) {
      this._setMessage('Weather unavailable');
      this._el.card.dataset.weather = 'unknown';
      this._drawIcon('unknown');
      this._drawStaticCanvas();
      return;
    }
    this._el.card.dataset.message = 'false';
    const attributes = entity.attributes || {};
    const condition = String(entity.state || 'unknown').toLowerCase();
    const locale = this._hass.locale?.language || this._hass.language || undefined;
    this._el.card.dataset.weather = condition;
    this._el.name.textContent = this.config.name || attributes.friendly_name || this.config.entity.replace(/^weather\./, '').replaceAll('_',' ');
    this._el.day.textContent = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(new Date());
    const temperatureUnit = attributes.temperature_unit || '°';
    const targetUnit = this._normalizeTemperatureUnit(this.config.temperature_unit && this.config.temperature_unit !== 'auto' ? this.config.temperature_unit : temperatureUnit);
    const sourceUnit = this._normalizeTemperatureUnit(temperatureUnit);
    const temperature = this._convertTemperature(attributes.temperature, sourceUnit, targetUnit);
    this._el.temperature.textContent = temperature == null ? '—' : String(Math.round(temperature));
    this._el.temperatureUnit.textContent = targetUnit;
    this._el.condition.textContent = this._conditionLabel(condition);
    this._drawIcon(condition);

    this._el.humidityTile.hidden = !this.config.show_humidity || attributes.humidity == null;
    if (!this._el.humidityTile.hidden) {
      const humidity = Math.max(0, Math.min(100, Number(attributes.humidity) || 0));
      this._el.humidityValue.textContent = `${Math.round(humidity)}%`;
      this._el.humidityFill.style.width = `${humidity}%`;
      this._el.humidityMeter.setAttribute('aria-valuenow', String(Math.round(humidity)));
      this._el.humidityMeter.setAttribute('aria-valuetext', `${Math.round(humidity)} percent`);
    }
    this._el.windTile.hidden = !this.config.show_wind || attributes.wind_speed == null;
    if (!this._el.windTile.hidden) {
      const wind = Number(attributes.wind_speed);
      const windUnit = attributes.wind_speed_unit || '';
      this._el.windValue.innerHTML = `${Number.isFinite(wind) ? this._escape(String(Math.round(wind))) : '—'} <span class="tile-unit">${this._escape(windUnit)}</span>`;
      const speedKmh = this._windToKmh(wind, windUnit);
      const meterValue = Math.max(0, Math.min(100, speedKmh / 120 * 100));
      this._el.windFill.style.width = `${meterValue}%`;
      this._el.windMeter.setAttribute('aria-valuemin', '0');
      this._el.windMeter.setAttribute('aria-valuemax', '100');
      this._el.windMeter.setAttribute('aria-valuenow', String(Math.round(meterValue)));
      this._el.windMeter.setAttribute('aria-valuetext', `${Math.round(wind)} ${windUnit}`);
    }
    this._el.details.hidden = this._el.humidityTile.hidden && this._el.windTile.hidden;
    this._renderForecast(attributes, locale, temperatureUnit, targetUnit);
    this._setMessage('');
    this._syncAnimation();
  }

  _setMessage(text) {
    this._el.card.dataset.message = text ? 'true' : 'false';
    this._el.message.textContent = text;
  }

  _requestForecast(force) {
    if (!this.config?.show_forecast || !this._hass || !this.isConnected) return;
    const entity = this._hass.states?.[this.config.entity];
    if (!entity || ['unavailable','unknown'].includes(entity.state)) return;
    if (this._forecastPromise) return;
    if (!force && Date.now() - this._forecastFetchedAt < 30 * 60 * 1000) return;
    const entityId = this.config.entity;
    this._forecastPromise = this._hass.callService(
      'weather', 'get_forecasts', { type: 'daily' }, { entity_id: entityId }, false, true
    ).then(result => {
      if (this.config?.entity !== entityId) return;
      const response = result?.response || result?.service_response || {};
      this._forecast = response?.[entityId]?.forecast || [];
      this._forecastFetchedAt = Date.now();
      this._updateCard();
    }).catch(() => {
      if (this.config?.entity === entityId) {
        this._forecast = [];
        this._forecastFetchedAt = Date.now();
        this._renderForecast(this._hass.states?.[entityId]?.attributes || {}, this._hass.locale?.language, '°C', '°C');
      }
    }).finally(() => {
      this._forecastPromise = null;
      if (this.config?.entity !== entityId) this._requestForecast(true);
    });
  }

  _renderForecast(attributes, locale, sourceUnit, targetUnit) {
    const forecasts = this.config.show_forecast ? this._forecast.slice(0,5) : [];
    this._el.forecast.hidden = !this.config.show_forecast || forecasts.length === 0;
    if (this._el.forecast.hidden) return;
    const formatDay = dateString => {
      const date = new Date(dateString);
      return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date);
    };
    this._el.forecast.innerHTML = forecasts.map((forecast, index) => {
      const high = this._convertTemperature(forecast.temperature, this._normalizeTemperatureUnit(sourceUnit), this._normalizeTemperatureUnit(targetUnit));
      const low = this._convertTemperature(forecast.templow, this._normalizeTemperatureUnit(sourceUnit), this._normalizeTemperatureUnit(targetUnit));
      const label = index === 0 ? 'Today' : formatDay(forecast.datetime);
      return `<div class="forecast-day"><span class="forecast-label">${this._escape(label)}</span><span class="forecast-icon" aria-hidden="true">${this._weatherSvg(forecast.condition || 'unknown')}</span><span class="forecast-temp">${high == null ? '—' : Math.round(high)}°${low == null ? '' : `<span class="forecast-low">${Math.round(low)}°</span>`}</span></div>`;
    }).join('');
  }

  _convertTemperature(value, from, to) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    const source = String(from).toLowerCase();
    const target = String(to).toLowerCase();
    const celsius = source.includes('f') ? (numeric - 32) * 5 / 9 : source.includes('k') ? numeric - 273.15 : numeric;
    if (target.includes('f')) return celsius * 9 / 5 + 32;
    if (target.includes('k')) return celsius + 273.15;
    return celsius;
  }

  _normalizeTemperatureUnit(unit) {
    const normalized = String(unit || '°C').toLowerCase();
    if (normalized.includes('f')) return '°F';
    if (normalized.includes('k')) return 'K';
    return '°C';
  }

  _windToKmh(value, unit) {
    const speed = Number(value) || 0;
    const u = String(unit).toLowerCase();
    if (u.includes('mph')) return speed * 1.60934;
    if (u === 'm/s' || u.includes('m s')) return speed * 3.6;
    if (u.includes('knot') || u === 'kn') return speed * 1.852;
    return speed;
  }

  _conditionLabel(condition) {
    const localizationKey = `component.weather.state.${condition}`;
    const translated = this._hass.localize?.(localizationKey);
    if (translated && translated !== localizationKey) return translated;
    return condition.replaceAll('-', ' ').replaceAll('_', ' ').replace(/\b\w/g, char => char.toUpperCase());
  }

  _drawIcon(condition) {
    this._el.icon.innerHTML = this._weatherSvg(condition);
    const svg = this._el.icon.querySelector('svg');
    svg?.setAttribute('aria-label', this._conditionLabel(condition));
  }

  _weatherSvg(condition) {
    const base = '';
    const cloud = '<path fill="#e5edf7" d="M24 69c0-11 9-20 20-20 3-15 16-26 32-26 15 0 28 10 32 24 15-5 31 6 31 22 0 13-10 23-24 23H48C34 92 24 82 24 69Z"/>';
    const sun = '<g fill="#ffd36d" stroke="#ffd36d" stroke-width="5" stroke-linecap="round"><circle cx="104" cy="43" r="21" stroke="none"/><path d="M104 8v11M104 67v11M69 43h11M128 43h11M79 18l8 8M121 60l8 8M129 18l-8 8M87 60l-8 8"/></g>';
    const rain = '<g fill="none" stroke="#64d7ff" stroke-width="7" stroke-linecap="round"><path d="m58 106-7 15M91 106l-7 15M124 106l-7 15"/></g>';
    const snow = '<g fill="none" stroke="#f4fbff" stroke-width="3" stroke-linecap="round"><path d="M57 108v18m-8-14 16 10m0-10-16 10M91 108v18m-8-14 16 10m0-10-16 10M125 108v18m-8-14 16 10m0-10-16 10"/></g>';
    const bolt = '<path fill="#ffd54f" d="m94 94-17 30h15l-5 22 25-35H96l8-17Z"/>';
    const fog = '<g fill="none" stroke="#e8f2fc" stroke-width="6" stroke-linecap="round" opacity=".9"><path d="M28 111h111M39 125h91M52 139h78"/></g>';
    const wind = '<g fill="none" stroke="#e8f5ff" stroke-width="5" stroke-linecap="round" opacity=".95"><path d="M22 112h92c12 0 12-16 0-16M34 126h112M27 140h67c12 0 12 16 0 16"/></g>';
    const hail = '<g fill="#f4fbff"><circle cx="60" cy="116" r="5"/><circle cx="91" cy="127" r="5"/><circle cx="122" cy="116" r="5"/></g>';
    const night = '<g><circle cx="103" cy="52" r="32" fill="#ffe7a3"/><circle cx="117" cy="40" r="30" fill="#30375f"/><g fill="#fff" opacity=".95"><circle cx="39" cy="34" r="2.5"/><circle cx="148" cy="48" r="2"/><circle cx="59" cy="20" r="1.8"/><circle cx="146" cy="17" r="1.7"/></g></g>';
    let art = cloud;
    if (condition === 'sunny') art = sun;
    else if (condition === 'partlycloudy') art = sun + '<path fill="#e5edf7" d="M30 85c0-8 7-15 16-15 2-11 12-18 23-18 10 0 18 6 21 15 12-4 23 5 23 16 0 10-8 17-18 17H49c-11 0-19-6-19-15Z"/>';
    else if (condition === 'clear-night') art = night;
    else if (condition === 'rainy' || condition === 'pouring') art += rain;
    else if (condition === 'lightning' || condition === 'lightning-rainy') art += rain + bolt;
    else if (condition === 'snowy' || condition === 'snowy-rainy') art += snow;
    else if (condition === 'fog') art += fog;
    else if (condition === 'windy' || condition === 'windy-variant') art += wind;
    else if (condition === 'hail') art += hail;
    else if (condition === 'exceptional') art += '<text x="83" y="120" fill="#ffd36d" font-size="42" font-weight="700">!</text>';
    return `<svg viewBox="0 0 180 170" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Weather condition">${base}${art}</svg>`;
  }

  _resizeCanvas() {
    if (!this._ctx) return;
    const rect = this._el.card.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width * ratio));
    const height = Math.max(1, Math.round(rect.height * ratio));
    if (this._el.canvas.width !== width || this._el.canvas.height !== height) {
      this._el.canvas.width = width;
      this._el.canvas.height = height;
      this._ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      this._drawStaticCanvas();
    }
  }

  _syncAnimation() {
    if (!this._ctx || !this.config) return;
    const shouldAnimate = this.config.animation !== false && !this._reducedMotion && this._visible && !document.hidden && this.isConnected;
    if (shouldAnimate) this._startAnimation();
    else {
      this._stopAnimation();
      this._drawStaticCanvas();
    }
  }

  _startAnimation() {
    if (this._raf) return;
    this._lastFrameAt = 0;
    const tick = timestamp => {
      if (!this.config?.animation || this._reducedMotion || !this._visible || document.hidden || !this.isConnected) {
        this._raf = 0;
        this._drawStaticCanvas();
        return;
      }
      if (timestamp - this._lastFrameAt >= 1000 / 24) {
        this._lastFrameAt = timestamp;
        this._drawCanvas(timestamp / 1000);
      }
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }

  _stopAnimation() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
  }

  _drawStaticCanvas() { this._drawCanvas(0, true); }

  _drawCanvas(time, staticFrame = false) {
    if (!this._ctx || !this._el.canvas.width) return;
    const ctx = this._ctx;
    const width = this._el.card.clientWidth;
    const height = this._el.card.clientHeight;
    ctx.clearRect(0, 0, width, height);
    const condition = this._el.card.dataset.weather || 'unknown';
    if (condition === 'rainy' || condition === 'pouring' || condition === 'lightning-rainy' || condition === 'lightning') this._paintRain(ctx, width, height, time, staticFrame);
    else if (condition === 'snowy' || condition === 'snowy-rainy') this._paintSnow(ctx, width, height, time, staticFrame);
    else if (condition === 'cloudy' || condition === 'partlycloudy' || condition === 'exceptional' || condition === 'unknown') this._paintClouds(ctx, width, height, time, staticFrame);
    else if (condition === 'sunny') this._paintSun(ctx, width, height, time, staticFrame);
    else if (condition === 'clear-night') this._paintNight(ctx, width, height, time, staticFrame);
    else if (condition === 'fog') this._paintFog(ctx, width, height, time, staticFrame);
    else if (condition === 'windy' || condition === 'windy-variant') this._paintWind(ctx, width, height, time, staticFrame);
    else if (condition === 'hail') this._paintHail(ctx, width, height, time, staticFrame);
  }

  _paintRain(ctx, w, h, t, fixed) {
    const storm = this._el.card.dataset.weather.includes('lightning');
    const count = storm ? 88 : this._el.card.dataset.weather === 'pouring' ? 66 : 42;
    ctx.strokeStyle = storm ? 'rgba(213,226,255,.38)' : 'rgba(198,232,255,.46)';
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    for (let i=0;i<count;i++) {
      const x = ((i * 73.37 + Math.sin(i * 12.17) * 23) % w + w) % w;
      const speed = storm ? 265 : 195;
      const y = fixed ? (i * 41) % h : (i * 41 + t * speed) % (h + 30) - 20;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 5, y + (storm ? 21 : 15)); ctx.stroke();
    }
    if (storm) {
      if (!fixed && t > (this._nextFlashAt || 0)) { this._flashStartedAt = t; this._nextFlashAt = t + 5 + ((Math.sin(t * 1.7) + 1) * 4); }
      const elapsed = fixed ? 99 : t - (this._flashStartedAt || -99);
      if (elapsed >= 0 && elapsed < .17) {
        ctx.fillStyle = `rgba(240,238,255,${.22 * (1 - elapsed / .17)})`;
        ctx.fillRect(0,0,w,h);
        ctx.fillStyle = 'rgba(255,239,157,.9)'; ctx.beginPath(); ctx.moveTo(w*.72,h*.13); ctx.lineTo(w*.67,h*.3); ctx.lineTo(w*.71,h*.3); ctx.lineTo(w*.65,h*.43); ctx.lineTo(w*.77,h*.26); ctx.lineTo(w*.73,h*.26); ctx.closePath(); ctx.fill();
      }
    }
  }

  _paintSnow(ctx, w, h, t, fixed) {
    const count = Math.min(34, Math.max(20, Math.floor(w / 14)));
    for (let i=0;i<count;i++) {
      const baseX = (i * 67.31) % w;
      const y = fixed ? (i * 43.3) % h : (i * 43.3 + t * (13 + i % 7)) % h;
      const drift = fixed ? 0 : Math.sin(t * .55 + i) * 13 + t * ((i % 3) - 1) * 2;
      const x = ((baseX + drift) % w + w) % w;
      const radius = 2.1 + (i % 3) * .65;
      ctx.save(); ctx.translate(x,y); ctx.rotate(fixed ? 0 : Math.sin(t*.2+i)*.25);
      ctx.strokeStyle = `rgba(255,255,255,${.44 + (i % 4) * .1})`; ctx.lineWidth = 1.1; ctx.lineCap = 'round';
      for(let arm=0;arm<3;arm++){const a=arm*Math.PI/3;const dx=Math.cos(a)*radius,dy=Math.sin(a)*radius;ctx.beginPath();ctx.moveTo(-dx,-dy);ctx.lineTo(dx,dy);ctx.stroke();}
      ctx.restore();
    }
  }

  _paintClouds(ctx, w, h, t, fixed) {
    for (let i=0;i<5;i++) {
      const x = fixed ? (i * w / 4) : ((i * w / 4 + t * (5 + i * 1.8)) % (w + 180)) - 90;
      const y = h * (.15 + (i % 3) * .18);
      ctx.fillStyle = `rgba(225,240,255,${.035 + (i % 2) * .018})`;
      ctx.beginPath(); ctx.ellipse(x,y,w*.21,h*.075,0,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x+w*.08,y+8,w*.12,h*.06,0,0,Math.PI*2); ctx.fill();
    }
  }

  _paintSun(ctx, w, h, t, fixed) {
    const x=w*.78,y=h*.24,r=Math.min(w,h)*.17;
    const glow=ctx.createRadialGradient(x,y,r*.18,x,y,r*2.8); glow.addColorStop(0,'rgba(255,219,131,.32)'); glow.addColorStop(1,'rgba(255,214,117,0)'); ctx.fillStyle=glow; ctx.fillRect(0,0,w,h);
    ctx.save();ctx.translate(x,y);ctx.rotate(fixed?0:t*.035);ctx.strokeStyle='rgba(255,229,168,.12)';ctx.lineWidth=18;ctx.lineCap='round';
    for(let i=0;i<12;i++){const a=i*Math.PI/6;ctx.beginPath();ctx.moveTo(Math.cos(a)*r*1.25,Math.sin(a)*r*1.25);ctx.lineTo(Math.cos(a)*r*2.1,Math.sin(a)*r*2.1);ctx.stroke();}ctx.restore();
  }

  _paintNight(ctx, w, h, t, fixed) {
    for(let i=0;i<42;i++){const x=(i*79.7+13)%w,y=(i*47.9+9)%(h*.78);const twinkle=fixed ? .8 : .45+.4*(.5+.5*Math.sin(t*1.2+i));ctx.fillStyle=`rgba(255,255,255,${twinkle})`;ctx.beginPath();ctx.arc(x,y,1+(i%3)*.55,0,Math.PI*2);ctx.fill();}
    const x=w*.78,y=h*.2,r=Math.min(w,h)*.105;ctx.fillStyle='rgba(255,237,186,.87)';ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(30,37,77,.92)';ctx.beginPath();ctx.arc(x+r*.48,y-r*.24,r*.9,0,Math.PI*2);ctx.fill();
  }

  _paintFog(ctx,w,h,t,fixed){for(let i=0;i<6;i++){const x=fixed?w*.5:((t*8+i*150)%(w+260))-130,y=h*(.3+i*.105);ctx.fillStyle=`rgba(236,246,255,${.055+(i%2)*.025})`;ctx.beginPath();ctx.ellipse(x,y,w*.42,12+i%3*5,0,0,Math.PI*2);ctx.fill();}}
  _paintWind(ctx,w,h,t,fixed){ctx.strokeStyle='rgba(227,247,255,.23)';ctx.lineWidth=2;ctx.lineCap='round';for(let i=0;i<15;i++){const y=(i*51+20)%h;const x=fixed?i*w/15:((i*79-t*(20+i%4*6))%(w+100)+w+100)%(w+100)-40;const len=18+(i%5)*12;ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+len*.4,y-5,x+len,y);ctx.stroke();}}
  _paintHail(ctx,w,h,t,fixed){for(let i=0;i<32;i++){const x=(i*61.7)%w,y=fixed?(i*43)%h:(i*43+t*58)%h;ctx.fillStyle='rgba(237,249,255,.52)';ctx.beginPath();ctx.arc(x,y,1.6+(i%3)*.55,0,Math.PI*2);ctx.fill();}}
  _escape(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
}

class WeatherGlassCardEditor extends HTMLElement {
  setConfig(config) { this._config = { show_humidity:true, show_wind:true, show_forecast:false, animation:true, temperature_unit:'auto', ...config }; this._render(); }
  set hass(hass) { this._hass = hass; this._render(); }
  _render() {
    if (!this._config) return;
    const entities = Object.entries(this._hass?.states || {}).filter(([id]) => id.startsWith('weather.'));
    const entityOptions = entities.map(([id,state]) => `<option value="${id}" ${id===this._config.entity?'selected':''}>${this._escape(state.attributes?.friendly_name||id)} (${id})</option>`).join('');
    this.innerHTML = `<div class="editor">
      <label>Weather entity<select data-key="entity"><option value="">Select a weather entity</option>${entityOptions}</select></label>
      <label>Location name (optional)<input data-key="name" value="${this._escape(this._config.name||'')}" placeholder="Use entity name"></label>
      <label>Temperature unit<select data-key="temperature_unit"><option value="auto">Entity unit</option><option value="°C">Celsius</option><option value="°F">Fahrenheit</option></select></label>
      <label class="check"><input data-key="show_humidity" type="checkbox" ${this._config.show_humidity?'checked':''}> Show humidity</label>
      <label class="check"><input data-key="show_wind" type="checkbox" ${this._config.show_wind?'checked':''}> Show wind</label>
      <label class="check"><input data-key="show_forecast" type="checkbox" ${this._config.show_forecast?'checked':''}> Show five-day forecast</label>
      <label class="check"><input data-key="animation" type="checkbox" ${this._config.animation?'checked':''}> Animate background</label></div>
      <style>.editor{display:grid;gap:12px;padding:12px 0}.editor label{display:grid;gap:5px}.editor input:not([type=checkbox]),.editor select{font:inherit;padding:8px;border:1px solid var(--divider-color,#888);border-radius:8px;background:var(--card-background-color,#fff);color:var(--primary-text-color,#111)}.editor .check{display:flex;align-items:center;gap:8px}</style>`;
    const unit = this.querySelector('[data-key="temperature_unit"]'); if(unit) unit.value=this._config.temperature_unit||'auto';
    this.querySelectorAll('[data-key]').forEach(input=>input.addEventListener('change',()=>{
      const key=input.dataset.key; this._config[key]=input.type==='checkbox'?input.checked:input.value;
      this.dispatchEvent(new CustomEvent('config-changed',{detail:{config:{...this._config}},bubbles:true,composed:true}));
    }));
  }
  _escape(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
}

customElements.define('weather-glass-card', WeatherGlassCard);
customElements.define('weather-glass-card-editor', WeatherGlassCardEditor);
window.customCards = window.customCards || [];
window.customCards.push({ type:'weather-glass-card', name:'Weather Glass Card', description:'Animated, weather-driven card with forecast support.', preview:true });
