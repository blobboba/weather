const form = document.querySelector("#weather-form");
const input = document.querySelector("#city-input");
const messages = document.querySelector("#messages");
const sendButton = document.querySelector(".send-button");
const composer = document.querySelector(".composer");
const sidePanel = document.querySelector(".side-panel");
const currentCity = document.querySelector("#current-city");
const currentTemp = document.querySelector("#current-temp");
const currentSummary = document.querySelector("#current-summary");
const metricGrid = document.querySelector("#metric-grid");
const weatherMark = document.querySelector("#weather-mark");
const themeButtons = document.querySelectorAll("[data-theme-choice]");
const systemThemeQuery = window.matchMedia("(prefers-color-scheme: dark)");

const weatherLabels = {
  0: "Ясно",
  1: "Преимущественно ясно",
  2: "Переменная облачность",
  3: "Пасмурно",
  45: "Туман",
  48: "Изморозь",
  51: "Легкая морось",
  53: "Морось",
  55: "Сильная морось",
  56: "Ледяная морось",
  57: "Сильная ледяная морось",
  61: "Небольшой дождь",
  63: "Дождь",
  65: "Сильный дождь",
  66: "Ледяной дождь",
  67: "Сильный ледяной дождь",
  71: "Небольшой снег",
  73: "Снег",
  75: "Сильный снег",
  77: "Снежные зерна",
  80: "Ливни",
  81: "Сильные ливни",
  82: "Очень сильные ливни",
  85: "Снегопад",
  86: "Сильный снегопад",
  95: "Гроза",
  96: "Гроза с градом",
  99: "Сильная гроза с градом",
};

const weatherThemeClasses = [
  "weather-sun",
  "weather-cloud",
  "weather-rain",
  "weather-snow",
  "weather-storm",
  "weather-fog",
];
const secretWeatherCommands = {
  ясно: "sun",
  облачно: "cloud",
  дождь: "rain",
  снег: "snow",
  гроза: "storm",
  туман: "fog",
};
let summaryAnimationTimer;
let themePreference = readThemePreference();

const iconPaths = {
  sun: '<circle cx="40" cy="40" r="15"/><path d="M40 8v10M40 62v10M8 40h10M62 40h10M17.4 17.4l7.1 7.1M55.5 55.5l7.1 7.1M62.6 17.4l-7.1 7.1M24.5 55.5l-7.1 7.1" stroke="currentColor" stroke-width="6" stroke-linecap="round" fill="none"/>',
  cloud: '<path d="M24 55h32a12 12 0 0 0 0-24h-2A19 19 0 0 0 17 37a9 9 0 0 0 7 18Z"/>',
  rain: '<path d="M24 45h32a12 12 0 0 0 0-24h-2A19 19 0 0 0 17 27a9 9 0 0 0 7 18Z"/><path d="M27 59l-4 8M42 59l-4 8M57 59l-4 8" stroke="currentColor" stroke-width="5" stroke-linecap="round" fill="none"/>',
  snow: '<path d="M24 45h32a12 12 0 0 0 0-24h-2A19 19 0 0 0 17 27a9 9 0 0 0 7 18Z"/><path d="M29 61h.1M42 66h.1M55 61h.1" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>',
  storm: '<path d="M24 43h32a12 12 0 0 0 0-24h-2A19 19 0 0 0 17 25a9 9 0 0 0 7 18Z"/><path d="M42 45l-8 15h9l-5 12 14-18h-9l5-9Z"/>',
  fog: '<path d="M24 40h32a12 12 0 0 0 0-24h-2A19 19 0 0 0 17 22a9 9 0 0 0 7 18Z"/><path d="M18 54h44M24 65h32" stroke="currentColor" stroke-width="5" stroke-linecap="round" fill="none"/>',
};

const dayFormatter = new Intl.DateTimeFormat("ru-RU", {
  weekday: "short",
  day: "numeric",
  month: "short",
});
const chartDayFormatter = new Intl.DateTimeFormat("ru-RU", { weekday: "short" });

applyTheme(themePreference);

themeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    themePreference = button.dataset.themeChoice;
    saveThemePreference(themePreference);
    applyTheme(themePreference);
  });
});

systemThemeQuery.addEventListener("change", () => {
  if (themePreference === "system") {
    applyTheme(themePreference);
  }
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = input.value.trim();
  if (query) {
    if (activateSecretWeatherTheme(query)) {
      input.value = "";
      input.focus();
      return;
    }

    requestForecast(query);
  }
});

document.querySelectorAll("[data-city]").forEach((button) => {
  button.addEventListener("click", () => {
    input.value = button.dataset.city;
    requestForecast(button.dataset.city);
  });
});

async function requestForecast(query) {
  const request = parseWeatherRequest(query);
  setLoading(true);
  addMessage("user", escapeHTML(query));
  input.value = "";

  const loadingMessage = addSkeletonMessage();

  try {
    const place = await geocodeCity(request);
    const weather = await fetchForecast(place);
    loadingMessage.remove();
    addForecastMessage(place, weather, request);
    updateSidePanel(place, weather);
  } catch (error) {
    loadingMessage.remove();
    addMessage(
      "assistant",
      `<p>${escapeHTML(error.message || "Не получилось получить прогноз. Попробуйте другой город.")}</p>`,
    );
  } finally {
    setLoading(false);
  }
}

async function geocodeCity(request) {
  if (!request.cityCandidates.length) {
    throw new Error("Уточните город в запросе, например: «нужен ли зонт завтра в Саратове?»");
  }

  for (const city of request.cityCandidates) {
    const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
    url.search = new URLSearchParams({
      name: city,
      count: "1",
      language: "ru",
      format: "json",
    });

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Геокодинг временно недоступен.");
    }

    const data = await response.json();
    if (data.results?.length) {
      return data.results[0];
    }
  }

  throw new Error(`Я не нашел город «${request.cityCandidates[0]}».`);
}

async function fetchForecast(place) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    current: "temperature_2m,weather_code,wind_speed_10m",
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max",
    timezone: "auto",
    forecast_days: "7",
  });

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Погодный API временно недоступен.");
  }

  return response.json();
}

function addForecastMessage(place, weather, request) {
  const location = formatLocation(place);
  const current = weather.current;
  const daily = weather.daily;
  const summary = weatherLabels[current.weather_code] || "Погодные данные";
  const insight = buildInsight(request, daily);

  addMessage(
    "assistant",
    `<div class="forecast-bubble">
      <div class="forecast-head">
        <div>
          <h2>${escapeHTML(location)}</h2>
          <p>${Math.round(current.temperature_2m)}°C, ${escapeHTML(summary)}</p>
        </div>
        <span>${escapeHTML(place.timezone || weather.timezone || "Местное время")}</span>
      </div>
      ${insight ? `<div class="weather-insight"><span aria-hidden="true">${insight.icon}</span><p>${escapeHTML(insight.text)}</p></div>` : ""}
      <div class="forecast-grid">
        ${daily.time.map((day, index) => renderDayCard(daily, day, index)).join("")}
      </div>
      ${renderWeatherChart(daily)}
    </div>`,
  );
}

function renderDayCard(daily, day, index) {
  const code = daily.weather_code[index];
  const kind = iconKind(code);
  const min = Math.round(daily.temperature_2m_min[index]);
  const max = Math.round(daily.temperature_2m_max[index]);
  const rain = daily.precipitation_probability_max[index] ?? 0;
  const wind = Math.round(daily.wind_speed_10m_max[index]);
  const label = weatherLabels[code] || "Прогноз";

  return `<article class="day-card weather-card-${kind}" style="--stagger: ${index}">
    <time datetime="${day}">${dayFormatter.format(new Date(`${day}T12:00:00`))}</time>
    <span class="day-icon">${weatherIcon(code)}</span>
    <div class="temp-row"><strong>${max}°</strong><span>${min}°</span></div>
    <div class="day-meta">
      <span>${escapeHTML(label)}</span>
      <span>${rain}% · ${wind} км/ч</span>
    </div>
  </article>`;
}

function updateSidePanel(place, weather) {
  const current = weather.current;
  const firstDay = weather.daily;
  const code = current.weather_code;
  const summary = weatherLabels[code] || "Погодные данные";

  currentCity.textContent = formatLocation(place);
  currentTemp.textContent = `${Math.round(current.temperature_2m)}°`;
  currentSummary.textContent = summary;
  weatherMark.innerHTML = weatherIcon(code);
  updateWeatherTheme(code);
  animateSidePanel();
  metricGrid.innerHTML = `
    <div>
      <span>Ветер</span>
      <b>${Math.round(current.wind_speed_10m)} км/ч</b>
    </div>
    <div>
      <span>Осадки</span>
      <b>${firstDay.precipitation_probability_max[0] ?? 0}%</b>
    </div>
  `;
}

function renderWeatherChart(daily) {
  const maximums = daily.temperature_2m_max.map((value) => Math.round(value));
  const minimums = daily.temperature_2m_min.map((value) => Math.round(value));
  const precipitation = daily.precipitation_probability_max.map((value) => value ?? 0);
  const minimum = Math.min(...minimums);
  const maximum = Math.max(...maximums);
  const range = Math.max(maximum - minimum, 1);
  const points = daily.time.map((_, index) => 42 + index * 92);
  const y = (value) => 88 - ((value - minimum) / range) * 60;
  const highLine = points.map((x, index) => `${x},${y(maximums[index])}`).join(" ");
  const lowLine = points.map((x, index) => `${x},${y(minimums[index])}`).join(" ");

  return `<section class="weather-chart" aria-label="График температуры и вероятности осадков">
    <div class="chart-header">
      <h3>Неделя в динамике</h3>
      <div class="chart-legend">
        <span class="legend-high">Макс.</span>
        <span class="legend-low">Мин.</span>
        <span class="legend-rain">Осадки</span>
      </div>
    </div>
    <svg class="chart-svg" viewBox="0 0 640 180" role="img" aria-label="Температура и вероятность осадков на семь дней">
      <line class="chart-axis" x1="20" y1="116" x2="620" y2="116"></line>
      ${points
        .map(
          (x, index) =>
            `<rect class="chart-bar" x="${x - 17}" y="${116 - precipitation[index] * 0.36}" width="34" height="${precipitation[index] * 0.36}" rx="10"></rect>`,
        )
        .join("")}
      <polyline class="chart-line chart-line-high" points="${highLine}"></polyline>
      <polyline class="chart-line chart-line-low" points="${lowLine}"></polyline>
      ${points
        .map(
          (x, index) =>
            `<circle class="chart-dot chart-dot-high" cx="${x}" cy="${y(maximums[index])}" r="4"></circle>
            <text class="chart-value" x="${x}" y="${y(maximums[index]) - 10}">${maximums[index]}°</text>
            <text class="chart-day" x="${x}" y="148">${escapeHTML(chartDayFormatter.format(new Date(`${daily.time[index]}T12:00:00`)))}</text>
            <text class="chart-rain-value" x="${x}" y="166">${precipitation[index]}%</text>`,
        )
        .join("")}
    </svg>
  </section>`;
}

function addMessage(type, html) {
  const message = document.createElement("article");
  message.className = `message ${type}`;
  const icon =
    type === "user"
      ? '<svg viewBox="0 0 24 24" role="img"><path d="M12 12.2a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-3.72 0-6.85 2.34-7.7 5.52-.16.6.3 1.18.92 1.18h13.56c.62 0 1.08-.58.92-1.18C18.85 16.54 15.72 14.2 12 14.2Z"/></svg>'
      : '<svg viewBox="0 0 24 24" role="img"><path d="M12 3.2a6.6 6.6 0 0 0-6.42 5.05A5.56 5.56 0 0 0 6.15 19.3h11.18a4.66 4.66 0 0 0 .45-9.3A6.62 6.62 0 0 0 12 3.2Zm0 2a4.62 4.62 0 0 1 4.48 3.55l.31 1.31 1.35-.03h.12a2.66 2.66 0 0 1-.26 5.31H6.15a3.56 3.56 0 0 1-.19-7.12l1.22-.06.28-1.19A4.61 4.61 0 0 1 12 5.2Z"/></svg>';

  message.innerHTML = `
    <div class="avatar" aria-hidden="true">${icon}</div>
    <div class="bubble">${html}</div>
  `;
  messages.append(message);
  scrollToLatestMessage(message);
  return message;
}

function scrollToLatestMessage(message) {
  const scroll = (behavior = "smooth") => {
    messages.scrollTo({
      top: messages.scrollHeight,
      behavior,
    });

    message.scrollIntoView({
      behavior,
      block: "end",
      inline: "nearest",
    });

    composer.scrollIntoView({
      behavior,
      block: "end",
      inline: "nearest",
    });
  };

  requestAnimationFrame(() => {
    scroll("smooth");
    requestAnimationFrame(() => scroll("auto"));
  });

  window.setTimeout(() => scroll("auto"), 180);
}

function addSkeletonMessage() {
  return addMessage(
    "assistant",
    `<div class="forecast-bubble skeleton-forecast" aria-label="Загрузка прогноза">
      <div class="skeleton-head">
        <span></span>
        <i></i>
      </div>
      <div class="skeleton-grid">
        ${Array.from({ length: 7 }, (_, index) => `<span style="--stagger: ${index}"></span>`).join("")}
      </div>
    </div>`,
  );
}

function setLoading(isLoading) {
  sendButton.disabled = isLoading;
  input.disabled = isLoading;
}

function parseWeatherRequest(query) {
  const cleaned = query.trim().replace(/[?!,.]+$/g, "");
  const normalized = cleaned.toLocaleLowerCase("ru-RU");
  const isNatural = /(погод|зонт|дожд|осад|снег|гроз|надет|одет|куртк|ветр|холод|тепл|жарк|гуля)/i.test(normalized);
  const intent = /зонт/i.test(normalized)
    ? "umbrella"
    : /дожд|осад|мокр|снег|гроз/i.test(normalized)
      ? "precipitation"
    : /надет|одет|куртк|одежд/i.test(normalized)
      ? "clothing"
      : /ветр/i.test(normalized)
        ? "wind"
        : /холод|тепл|жарк/i.test(normalized)
          ? "temperature"
          : "forecast";
  const period = /послезавтра/i.test(normalized)
    ? { type: "day", indexes: [2], label: "послезавтра" }
    : /завтра/i.test(normalized)
      ? { type: "day", indexes: [1], label: "завтра" }
      : /выходн/i.test(normalized)
        ? { type: "weekend", indexes: [], label: "на выходных" }
        : /сегодня/i.test(normalized)
          ? { type: "day", indexes: [0], label: "сегодня" }
          : { type: "range", indexes: [0, 1, 2, 3, 4, 5, 6], label: "в ближайшие дни" };

  return {
    intent,
    isNatural,
    period,
    cityCandidates: extractCityCandidates(cleaned, isNatural),
  };
}

function extractCityCandidates(query, isNatural) {
  if (!isNatural) {
    return createCityVariants(query);
  }

  const afterPreposition = query.match(/(?:^|\s)(?:в|во)\s+(.+)$/i)?.[1] || "";
  const stoppedCity = afterPreposition
    .split(/\s+(?:сегодня|завтра|послезавтра|на|будет|ожидается|идет|идёт|нужен|нужна|можно|что|как)(?=\s|$)/i)[0]
    .trim();

  if (stoppedCity) {
    return createCityVariants(stoppedCity);
  }

  const remainder = query
    .replace(
      /(?:^|\s)(?:какая|какой|будет|погода|прогноз|нужен|нужна|ли|зонт|дождь|осадки|снег|что|надеть|одеть|сегодня|завтра|послезавтра|на|выходных|выходные|ветер|жарко|холодно|тепло|в)(?=\s|$)/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();

  return remainder ? createCityVariants(remainder) : [];
}

function createCityVariants(city) {
  const normalized = city.trim();
  if (!normalized) return [];

  const variants = [normalized];
  if (/[еЕ]$/.test(normalized)) {
    variants.push(normalized.slice(0, -1));
    variants.push(`${normalized.slice(0, -1)}а`);
  }
  if (/[иИ]$/.test(normalized)) {
    variants.push(`${normalized.slice(0, -1)}ь`);
  }

  return [...new Set(variants)];
}

function buildInsight(request, daily) {
  if (!request.isNatural) return null;

  const indexes = getInsightIndexes(request.period, daily.time);
  const rain = Math.max(...indexes.map((index) => daily.precipitation_probability_max[index] ?? 0));
  const wind = Math.max(...indexes.map((index) => daily.wind_speed_10m_max[index] ?? 0));
  const high = Math.max(...indexes.map((index) => daily.temperature_2m_max[index]));
  const low = Math.min(...indexes.map((index) => daily.temperature_2m_min[index]));
  const hasWetWeather = indexes.some((index) => ["rain", "snow", "storm"].includes(iconKind(daily.weather_code[index])));
  const label = request.period.label;

  if (request.intent === "umbrella") {
    const needsUmbrella = rain >= 40 || hasWetWeather;
    return {
      icon: needsUmbrella ? "☂" : "✓",
      text: needsUmbrella
        ? `Да, ${label} лучше взять зонт: вероятность осадков достигает ${rain}%.`
        : `Скорее всего, ${label} зонт не понадобится: вероятность осадков до ${rain}%.`,
    };
  }

  if (request.intent === "precipitation") {
    const likely = rain >= 40 || hasWetWeather;
    return {
      icon: likely ? "☂" : "✓",
      text: likely
        ? `Осадки ${label} вероятны: вероятность достигает ${rain}%.`
        : `Осадки ${label} маловероятны: вероятность не выше ${rain}%.`,
    };
  }

  if (request.intent === "clothing") {
    const advice =
      low <= 5
        ? "Понадобятся теплая куртка и закрытая обувь."
        : low <= 14
          ? "Возьмите легкую куртку или слой потеплее."
          : high >= 27
            ? "Подойдет легкая одежда, не забудьте воду."
            : "Комфортно будет в легкой одежде с тонким верхним слоем.";
    return { icon: "◌", text: `${label[0].toUpperCase()}${label.slice(1)} ожидается от ${Math.round(low)}° до ${Math.round(high)}°. ${advice}` };
  }

  if (request.intent === "wind") {
    return {
      icon: "≈",
      text: `${label[0].toUpperCase()}${label.slice(1)} ветер усилится до ${Math.round(wind)} км/ч. ${wind >= 30 ? "Будет ощутимо ветрено." : "Сильного ветра не ожидается."}`,
    };
  }

  return {
    icon: "✦",
    text: `${label[0].toUpperCase()}${label.slice(1)} температура будет от ${Math.round(low)}° до ${Math.round(high)}°, вероятность осадков до ${rain}%.`,
  };
}

function getInsightIndexes(period, days) {
  if (period.type === "weekend") {
    const weekend = days
      .map((day, index) => ({ index, weekday: new Date(`${day}T12:00:00`).getDay() }))
      .filter(({ weekday }) => weekday === 0 || weekday === 6)
      .map(({ index }) => index);
    return weekend.length ? weekend : [days.length - 1];
  }

  return period.indexes.filter((index) => index < days.length);
}

function formatLocation(place) {
  return [place.name, place.admin1, place.country].filter(Boolean).join(", ");
}

function weatherIcon(code, size) {
  const kind = iconKind(code);
  const sizeStyle = size ? ` style="--icon-size: ${size}px"` : "";
  return `<span class="weather-glyph weather-glyph-${kind}"${sizeStyle}><svg viewBox="0 0 80 80" role="img" aria-hidden="true">${iconPaths[kind]}</svg></span>`;
}

function iconKind(code) {
  if ([0, 1].includes(code)) return "sun";
  if ([45, 48].includes(code)) return "fog";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
  if ([95, 96, 99].includes(code)) return "storm";
  return "cloud";
}

function updateWeatherTheme(code) {
  setWeatherTheme(iconKind(code));
}

function setWeatherTheme(kind) {
  document.body.classList.remove(...weatherThemeClasses);
  document.body.classList.add(`weather-${kind}`);
}

function activateSecretWeatherTheme(query) {
  const command = query.toLocaleLowerCase("ru-RU").replace(/[.!?]+$/g, "").trim();
  const kind = secretWeatherCommands[command];
  if (!kind) return false;

  setWeatherTheme(kind);
  return true;
}

function animateSidePanel() {
  window.clearTimeout(summaryAnimationTimer);
  sidePanel.classList.remove("is-updating");
  requestAnimationFrame(() => {
    sidePanel.classList.add("is-updating");
    summaryAnimationTimer = window.setTimeout(() => sidePanel.classList.remove("is-updating"), 620);
  });
}

function readThemePreference() {
  try {
    return localStorage.getItem("weather-theme") || "system";
  } catch {
    return "system";
  }
}

function saveThemePreference(preference) {
  try {
    localStorage.setItem("weather-theme", preference);
  } catch {
    // Ignore storage restrictions in private browsing contexts.
  }
}

function applyTheme(preference) {
  const resolved = preference === "system" ? (systemThemeQuery.matches ? "dark" : "light") : preference;
  document.documentElement.dataset.theme = resolved;
  themeButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.themeChoice === preference));
  });
}

function escapeHTML(value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[char],
  );
}
