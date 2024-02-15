// Global variables
let currentDataInterval, historicDataInterval;
let barometerChart,
  humidityChart,
  temperatureChart,
  wetBulbChart,
  windSpeedChart,
  windDirChart;
// Global variables to keep track of chart instances
const chartInstances = {};
let lastFetchedTS = 0; // This will hold the last fetched current 'ts' value

function replaceTextInDOM(node, searchText, replaceText) {
  if (node.nodeType === Node.TEXT_NODE) {
    if (node.nodeValue.includes(searchText)) {
      node.nodeValue = node.nodeValue.replace(
        new RegExp(searchText, "g"),
        replaceText
      );
    }
  } else {
    for (let child of node.childNodes) {
      replaceTextInDOM(child, searchText, replaceText);
    }
  }
}
window.onload = () => {
  const hostName = window.location.hostname;
  replaceTextInDOM(document.body, "example.com", hostName);
};

document.getElementById("infoButton").onclick = function () {
  document.getElementById("infoModal").style.display = "block";
};

document.querySelector(".close-button").onclick = function () {
  document.getElementById("infoModal").style.display = "none";
};

// Optionally, to close the modal when clicking outside of it
window.onclick = function (event) {
  let modal = document.getElementById("infoModal");
  if (event.target == modal) {
    modal.style.display = "none";
    document.querySelector(".container").classList.remove("active"); // Remove blur effect
  }
};

// This function formats and displays the API schema in the modal.
function displayApiSchemaExample(currentData) {
  const apiSchemaElement = document.getElementById("api-schema-example");
  const hostName = window.location.hostname;
  const exampleData = JSON.stringify(currentData, null, 2); // Pretty-print the current data

  const apiSchemaTemplate = `GET /current
Host: ${hostName}

Response:
${exampleData}`;

  // Use innerText instead of textContent to preserve formatting
  apiSchemaElement.innerText = apiSchemaTemplate;
}

function displayHistoricApiSchema(dataToShow) {
  const apiSchemaElement = document.getElementById(
    "api-schema-example-historic"
  );
  const hostName = window.location.hostname;
  const exampleData = JSON.stringify(dataToShow, null, 2); // Pretty-print the dataToShow

  const apiSchemaTemplate = `GET /historic?start-timestamp=[start-timestamp]&end-timestamp=[end-timestamp]
Host: ${hostName}
Parameters:
    start-timestamp (optional): The start time in UNIX timestamp format.
                                Default is 7 days ago.
    end-timestamp (optional): The end timestamp in UNIX timestamp format.
                              Default is the current time.
Response:
${exampleData}`;

  apiSchemaElement.innerText = apiSchemaTemplate;
}

// Helper function to create a single card
function createCard(
  title,
  value,
  isWindDirection = false,
  rotationDegree = 0,
  valueId = ""
) {
  const card = document.createElement("div");
  card.className = "card";
  const pElement = `<p${valueId ? ` id="${valueId}"` : ""}>${value}</p>`;

  let contentHTML = isWindDirection
    ? `
        <h3>${title}</h3>
        <div class="wind-direction-content">
            ${pElement}
            <img class="compass-icon" src="/static/pointer.svg" alt="Compass" style="transform: rotate(${rotationDegree}deg);" />
        </div>`
    : `<h3>${title}</h3>
        ${pElement}`;

  card.innerHTML = contentHTML;

  // Apply animation to h3 and p elements
  const h3Element = card.querySelector("h3");
  const pElementInCard = card.querySelector("p");
  if (pElementInCard) applyFadeInAnimation(pElementInCard);

  return card;
}

// Fetch data from the server
async function fetchData(url) {
  const response = await fetch(url);
  return response.json();
}

function updateTimeSinceLastUpdate(lastSeenUnixTime) {
  const currentTime = Math.floor(new Date().getTime() / 1000);
  const ageInSeconds = currentTime - lastSeenUnixTime;
  const ageMinutes = Math.floor(ageInSeconds / 60);
  const ageSeconds = ageInSeconds % 60;
  const ageP = document.getElementById("data-age");

  if (ageP) ageP.textContent = `${ageMinutes}m ${ageSeconds}s ago`;
}

function applyFadeInAnimation(element) {
  element.classList.add("text-fade-in-slide");
  element.addEventListener("animationend", () => {
    element.classList.remove("text-fade-in-slide");
  });
}

// Render the current data section
async function renderCurrentData() {
  console.log("Fetching current data...");
  const data = await fetchData("/current");
  displayApiSchemaExample(data);
  const sensorData = data.data[0];
  lastFetchedTS = sensorData.ts;
  updateImportantMetrics(sensorData);
  updateOtherMetrics(sensorData);
}

// Constants for color ranges
const COLOR_RANGES = {
  RED_MAX: 255,
  GREEN_MAX: 255,
  BLUE_MAX: 255,
  TEMPERATURE_COLD: 32,
  TEMPERATURE_WARM: 60,
  TEMPERATURE_HOT: 80,
  TEMPERATURE_VERY_HOT: 90,
  HUMIDITY_DRY: 40,
  HUMIDITY_MOIST: 60,
};

// Helper function to interpolate color values
function interpolateColor(minValue, maxValue, startRange, endRange, value) {
  return Math.floor(
    startRange +
    ((value - minValue) * (endRange - startRange)) / (maxValue - minValue)
  );
}

// Map temperature to a color
function getColorForTemperature(value) {
  let {
    RED_MAX,
    GREEN_MAX,
    BLUE_MAX,
    TEMPERATURE_COLD,
    TEMPERATURE_WARM,
    TEMPERATURE_HOT,
    TEMPERATURE_VERY_HOT,
  } = COLOR_RANGES;
  let red = 0,
    green = 0,
    blue = 0;

  if (value < TEMPERATURE_COLD) {
    blue = BLUE_MAX;
  } else if (value < TEMPERATURE_WARM) {
    blue = interpolateColor(
      TEMPERATURE_COLD,
      TEMPERATURE_WARM,
      BLUE_MAX,
      0,
      value
    );
    green = interpolateColor(
      TEMPERATURE_COLD,
      TEMPERATURE_WARM,
      0,
      GREEN_MAX,
      value
    );
  } else if (value < TEMPERATURE_HOT) {
    green = GREEN_MAX;
    red = interpolateColor(
      TEMPERATURE_WARM,
      TEMPERATURE_HOT,
      0,
      RED_MAX,
      value
    );
  } else if (value < TEMPERATURE_VERY_HOT) {
    red = RED_MAX;
    green = interpolateColor(
      TEMPERATURE_HOT,
      TEMPERATURE_VERY_HOT,
      GREEN_MAX,
      0,
      value
    );
  } else {
    red = RED_MAX;
  }

  let rgba = `rgba(${red}, ${green}, ${blue}, 0.2)`;
  return {
    color: rgba,
    borderColor: rgba.replace("0.2", "1"),
  };
}

// Map humidity to a color
function getColorForHumidity(value) {
  let { HUMIDITY_DRY, HUMIDITY_MOIST } = COLOR_RANGES;
  let red = 0,
    green = 0,
    blue = 0;

  if (value < HUMIDITY_DRY) {
    red = interpolateColor(0, HUMIDITY_DRY, 139, 222, value);
    green = interpolateColor(0, HUMIDITY_DRY, 69, 184, value);
    blue = interpolateColor(0, HUMIDITY_DRY, 19, 135, value);
  } else if (value < HUMIDITY_MOIST) {
    red = interpolateColor(HUMIDITY_DRY, HUMIDITY_MOIST, 222, 144, value);
    green = interpolateColor(HUMIDITY_DRY, HUMIDITY_MOIST, 184, 238, value);
    blue = interpolateColor(HUMIDITY_DRY, HUMIDITY_MOIST, 135, 144, value);
  } else {
    red = interpolateColor(HUMIDITY_MOIST, 100, 144, 0, value);
    green = interpolateColor(HUMIDITY_MOIST, 100, 238, 0, value);
    blue = interpolateColor(HUMIDITY_MOIST, 100, 144, 255, value);
  }

  let rgba = `rgba(${red}, ${green}, ${blue}, 0.2)`;
  return {
    color: rgba,
    borderColor: rgba.replace("0.2", "1"),
  };
}

// Mapping wind speed to color
const WIND_SPEED_COLORS = {
  LOW: { color: "rgba(57, 255, 20, 0.2)", borderColor: "rgba(57, 255, 20, 1)" },
  MEDIUM: { color: "rgba(0, 255, 0, 0.2)", borderColor: "rgba(0, 255, 0, 1)" },
  MEDIUM_HIGH: {
    color: "rgba(255, 255, 0, 0.2)",
    borderColor: "rgba(255, 255, 0, 1)",
  },
  HIGH: {
    color: "rgba(255, 165, 0, 0.4)",
    borderColor: "rgba(255, 165, 0, 1)",
  },
  VERY_HIGH: {
    color: "rgba(255, 0, 0, 0.2)",
    borderColor: "rgba(255, 0, 0, 1)",
  },
};

function getWindSpeedColor(value) {
  if (value < 3) return WIND_SPEED_COLORS.LOW;
  if (value < 6) return WIND_SPEED_COLORS.MEDIUM;
  if (value < 9) return WIND_SPEED_COLORS.MEDIUM_HIGH;
  if (value <= 12) return WIND_SPEED_COLORS.HIGH;
  return WIND_SPEED_COLORS.VERY_HIGH;
}

function getBackgroundColorForMetric(label, value) {
  let colorDetails = {};

  switch (label) {
    case "Temperature":
      colorDetails = getColorForTemperature(value);
      break;
    case "Humidity":
      colorDetails = getColorForHumidity(value);
      break;
    case "Wind Speed":
    case "Wind Gusts":
      colorDetails = getWindSpeedColor(value);
      break;
    default:
      colorDetails.color = "rgba(114, 137, 218, 0.5)";
      colorDetails.borderColor = "rgba(114, 137, 218, 1)";
      break;
  }

  // Ensure that colorDetails has a color property
  if (!colorDetails.color) {
    console.error("Color not defined for metric:", label);
    return { color: "rgba(0, 0, 0, 0.2)", borderColor: "rgba(0, 0, 0, 1)" }; // Default to black if color not found
  }

  // Set borderColor based on color if not explicitly defined
  if (!colorDetails.borderColor) {
    colorDetails.borderColor = colorDetails.color.replace("0.2", "1");
  }

  return colorDetails;
}

function updateImportantMetrics(sensorData) {
  const importantMetricsDiv = document.querySelector(".important-metrics");

  // Ensure the structure with left and right divs and the divider
  let importantMetricsLeftDiv = importantMetricsDiv.querySelector(
    ".important-metrics-left"
  );
  let importantMetricsRightDiv = importantMetricsDiv.querySelector(
    ".important-metrics-right"
  );
  let divider = importantMetricsDiv.querySelector(".important-metrics-divider");

  if (!importantMetricsLeftDiv) {
    importantMetricsLeftDiv = document.createElement("div");
    importantMetricsLeftDiv.className = "important-metrics-left";
    importantMetricsDiv.appendChild(importantMetricsLeftDiv);
  }

  if (!importantMetricsRightDiv) {
    importantMetricsRightDiv = document.createElement("div");
    importantMetricsRightDiv.className = "important-metrics-right";
    importantMetricsDiv.appendChild(importantMetricsRightDiv);
  }

  if (!divider) {
    divider = document.createElement("div");
    divider.className = "important-metrics-divider";
    importantMetricsDiv.appendChild(divider);
  }

  const metrics = [
    {
      label: "Temperature",
      value: `${parseFloat(sensorData.temp).toFixed(1)}°F`,
      side: "left",
    },
    {
      label: "Humidity",
      value: `${parseFloat(sensorData.hum).toFixed(1)}%`,
      side: "left",
    },
    {
      label: "Wind Speed",
      value: `${parseFloat(sensorData.wind_speed_avg_last_10_min).toFixed(
        1
      )} MPH`,
      side: "right",
    },
    {
      label: "Wind Gusts",
      value: `${parseFloat(sensorData.wind_speed_hi_last_10_min)} MPH`,
      side: "right",
    },
  ];

  const delayIncrement = 30; // milliseconds to wait before updating the next metric

  metrics.forEach((metric, index) => {
    let metricElement = document.querySelector(
      `.important-metrics-${metric.side} .important-metrics-card[data-metric="${metric.label}"]`
    );

    const updateCard = () => {
      updateImportantMetricCard(metricElement, metric);
    };

    if (!metricElement) {
      // Card does not exist yet, create it without delay
      metricElement = createImportantMetricCard(metric);
      document
        .querySelector(`.important-metrics-${metric.side}`)
        .appendChild(metricElement);
      updateCard(); // Update immediately
    } else {
      // Card exists, apply cascade delay
      const delay = index * delayIncrement;
      setTimeout(updateCard, delay);
    }
  });
}

function updateImportantMetricCard(metricElement, metric) {
  metricElement.setAttribute("data-metric", metric.label);
  const valueElement = metricElement.querySelector(".important-value");
  valueElement.textContent = metric.value;
  applyFadeInAnimation(valueElement);

  const { color, borderColor } = getBackgroundColorForMetric(
    metric.label,
    parseFloat(metric.value)
  );
  metricElement.style.backgroundColor = color;
  metricElement.style.borderColor = borderColor;

  if (
    (metric.label === "Wind Speed" || metric.label === "Wind Gusts") &&
    parseFloat(metric.value) >= 12
  ) {
    metricElement.classList.add("attention-grabbing");
  } else {
    metricElement.classList.remove("attention-grabbing");
  }
}

function createImportantMetricCard(metric) {
  const card = document.createElement("div");
  card.className = "important-metrics-card";
  card.setAttribute("data-metric", metric.label);

  const contentHTML = `
        <div class="important-label">${metric.label}</div>
        <div class="important-value">${metric.value}</div>
    `;

  card.innerHTML = contentHTML;
  applyFadeInAnimation(card); // Apply animation to the whole card

  // Apply background color based on the value
  const { color, borderColor } = getBackgroundColorForMetric(
    metric.label,
    parseFloat(metric.value)
  );
  card.style.backgroundColor = color;
  card.style.borderColor = borderColor;

  return card;
}

// Function to calculate the start time from the current timestamp and uptime, then format it
function calculateStartTime(currentTimestamp, uptimeSeconds) {
  const startTime = currentTimestamp - uptimeSeconds;
  return unixToHumanReadable(startTime);
}

// Function to convert Unix timestamp to human-readable format
function unixToHumanReadable(unixTimestamp) {
  const date = new Date(unixTimestamp * 1000);
  return date.toLocaleDateString();
}


function getPreciseCardinalDirection(degree) {
  // Normalize the degree to be within 0-359
  degree = degree % 360;
  if (degree < 0) {
    degree += 360; // Handle negative degrees
  }

  const directions = [
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSW",
    "SW",
    "WSW",
    "W",
    "WNW",
    "NW",
    "NNW",
  ];

  const index = Math.round(degree / 22.5) % 16;
  return directions[index];
}

function updateOtherMetrics(sensorData) {
  const currentDataDiv = document.getElementById("current-data");
  const combinedMetrics = prepareMetrics(sensorData);

  let delayIncrement = 30; // milliseconds for each subsequent card update

  combinedMetrics.forEach((metric, index) => {
    let card = currentDataDiv.querySelector(
      `.card[data-metric="${metric.name}"]`
    );

    const updateCard = () => {
      updateMetricCard(card, metric, sensorData);
    };

    if (!card) {
      // Card does not exist yet, create and update it immediately
      card = createMetricCard(metric, sensorData);
      currentDataDiv.appendChild(card);
      updateCard(); // Update immediately
    } else {
      // Card exists, apply cascade delay
      const delay = index * delayIncrement; // Calculate delay based on index
      setTimeout(updateCard, delay);
    }
  });
}

function prepareMetrics(sensorData) {
  return [
    {
      name: "wind_direction",
      label: "Wind Direction",
      unit: "°",
      value: sensorData.wind_dir_scalar_avg_last_10_min,
      isWindDirection: true,
    },
    {
      name: "bar_absolute",
      label: "Barometric Pressure",
      unit: "inHg",
      value: sensorData.bar_absolute,
    },
    {
      name: "uv_index",
      label: "UV Index",
      unit: "",
      value: sensorData.uv_index,
    },
    {
      name: "solar_rad",
      label: "Solar Radiation",
      unit: "W/m²",
      value: sensorData.solar_rad,
    },
    {
      name: "dew_point",
      label: "Dew Point",
      unit: "°F",
      value: sensorData.dew_point,
    },
    {
      name: "wind_chill",
      label: "Wind Chill",
      unit: "°F",
      value: sensorData.wind_chill,
    },
    {
      name: "heat_index",
      label: "Heat Index",
      unit: "°F",
      value: sensorData.heat_index,
    },
    {
      name: "thw_index",
      label: "THW Index",
      unit: "°F",
      value: sensorData.thw_index,
    },
    {
      name: "input_voltage",
      label: "Input Voltage",
      unit: "V",
      value: sensorData.input_voltage / 1000,
    }, // Dividing by 1000 to convert millivolts to volts
    {
      name: "wifi_rssi",
      label: "Uplink WiFi RSSI",
      unit: "dBm",
      value: sensorData.wifi_rssi,
    },
    {
      name: "link_uptime",
      label: "Last Uplink Boot",
      unit: "",
      value: calculateStartTime(sensorData.ts, sensorData.link_uptime),
    },
    {
      name: "uptime",
      label: "Last Station Boot",
      unit: "",
      value: calculateStartTime(sensorData.ts, sensorData.uptime),
    },
    {
      name: "rainfall_last_24_hr_mm",
      label: "Rainfall Last 24hr",
      unit: "mm",
      value: sensorData.rainfall_last_24_hr_mm,
    },
    {
      name: "rainfall_last_60_min_mm",
      label: "Rainfall Last 60min",
      unit: "mm",
      value: sensorData.rainfall_last_60_min_mm,
    },
    {
      name: "rainfall_last_15_min_mm",
      label: "Rainfall Last 15min",
      unit: "mm",
      value: sensorData.rainfall_last_15_min_mm,
    },
    {
      name: "data_age",
      label: "Data Age",
      unit: "",
      value: getDataAge(sensorData.ts),
      isDataAge: true,
    },
  ];
}

function createMetricCard(metric, sensorData) {
  const card = document.createElement("div");
  card.className = "card";
  card.setAttribute("data-metric", metric.name);

  let contentHTML;
  if (metric.isWindDirection) {
    const rotationDegree = getWindDirectionRotationDegree(
      sensorData.wind_dir_scalar_avg_last_10_min
    );
    const cardinalDirection = getPreciseCardinalDirection(rotationDegree);
    const windDirectionValue = `${cardinalDirection} ${rotationDegree}°`;
    contentHTML = `
            <h3>${metric.label}</h3>
            <div class="wind-direction-content">
                <p id="${metric.name}">${windDirectionValue}</p>
                <img class="compass-icon" src="/static/pointer.svg" alt="Compass" style="transform: rotate(${rotationDegree}deg);" />
            </div>`;
  } else if (metric.isDataAge) {
    contentHTML = `
            <h3>${metric.label}</h3>
            <p id="data-age">${metric.value}</p>`;
  } else {
    contentHTML = `
            <h3>${metric.label}</h3>
            <p id="${metric.name}">${metric.value} ${metric.unit}</p>`;
  }

  card.innerHTML = contentHTML;
  applyFadeInAnimation(card);
  return card;
}

let isFirstPageLoad = true;

function updateMetricCard(card, metric, sensorData) {
  let valueElement = card.querySelector(`p#${metric.name}`);
  // Check if valueElement exists
  if (!valueElement) {
    // Skip error logging for data_age on first page load
    if (!(metric.name === 'data_age' && isFirstPageLoad)) {
      return;
    }
    console.error(`Element with id ${metric.name} not found in card.`);
    return; // Exit the function if the element is not found
  }
  // After the first update, set isFirstPageLoad to false
  isFirstPageLoad = false;

  if (metric.isWindDirection) {
    const rotationDegree = getWindDirectionRotationDegree(sensorData.wind_dir_scalar_avg_last_10_min);
    const cardinalDirection = getPreciseCardinalDirection(rotationDegree);
    const windDirectionValue = `${cardinalDirection} ${rotationDegree}°`;
    valueElement.textContent = windDirectionValue;
    applyFadeInAnimation(valueElement);

    const compassIcon = card.querySelector(".compass-icon");
    // Check if compassIcon exists
    if (compassIcon) {
      compassIcon.style.transform = `rotate(${rotationDegree}deg)`;
    } else {
      console.error("Compass icon not found in card.");
    }
  } else if (metric.isDataAge) {
    valueElement.textContent = getDataAge(sensorData.ts);
    applyFadeInAnimation(valueElement);
  } else {
    valueElement.textContent = `${metric.value} ${metric.unit}`;
    applyFadeInAnimation(valueElement);
  }
}

function getWindDirectionRotationDegree(degree) {
  // Normalize the degree to be within 0-359
  degree = degree % 360;
  if (degree < 0) {
    degree += 360; // Handle negative degrees
  }
  return degree;
}

// Function to get Data Age in "minutes and seconds ago"
function getDataAge(lastFetchedTS) {
  const currentTime = Math.floor(new Date().getTime() / 1000);
  const ageInSeconds = currentTime - lastFetchedTS;
  const ageMinutes = Math.floor(ageInSeconds / 60);
  const ageSeconds = ageInSeconds % 60;
  return `${ageMinutes}m ${ageSeconds}s ago`;
}

// Helper function to format time as "X hrs, Y min ago" or "date:time"
function formatTimeAgo(unixTimestamp) {
  const now = new Date();
  const timestamp = new Date(unixTimestamp * 1000);
  const diff = now - timestamp;

  if (diff < 24 * 3600 * 1000) {
    // Less than 24 hours
    const hours = Math.floor(diff / (3600 * 1000));
    const minutes = Math.ceil((diff % (3600 * 1000)) / 60000);
    return `${hours}h ${minutes}m ago`;
  } else {
    return timestamp.toLocaleString(); // More than 24 hours
  }
}

function createChartContainers(chartSpecs) {
  const chartsContainer = document.getElementById("charts-container");
  chartsContainer.innerHTML = ""; // Clear existing chart containers

  Object.keys(chartSpecs).forEach((chartName) => {
    const chartCardDiv = document.createElement("div");
    chartCardDiv.className = "chart-card";

    const chartDiv = document.createElement("div");
    chartDiv.id = `historic-chart-${chartName}`;

    chartCardDiv.appendChild(chartDiv);
    chartsContainer.appendChild(chartCardDiv);
  });
}

const chartSpecs = {
  // 'all': ['wind_speed_avg', 'wind_speed_hi', 'temp_avg', 'hum_hi', 'bar_absolute', 'dew_point_hi', 'wet_bulb_hi', 'uv_index_avg'],
  temperature: ["temp_avg", "temp_hi", "temp_lo"],
  humidity: ["hum_hi", "hum_lo"],
  "wind-speed": ["wind_speed_avg", "wind_speed_hi"],
  "wind-angle": ["wind_speed_hi_dir", "wind_dir_of_prevail"],
  barometer: ["bar_absolute", "bar_hi", "bar_lo", "bar_sea_level"],
  solar: ["solar_rad_avg", "solar_rad_hi"],
  rainfall_hourly: ["rainfall_mm"],
  rainfall_daily: ["rainfall_mm"],

  "dew-point": ["dew_point_hi", "dew_point_last", "dew_point_lo"],
  "wet-bulb": ["wet_bulb_hi", "wet_bulb_last", "wet_bulb_lo"],
  "uv-index": ["uv_index_avg", "uv_index_hi"],
  "battery-voltage": ["battery_voltage"],
  "input-voltage": ["input_voltage"],
  "signals-strengths": ["wifi_rssi", "rssi"],
  "packet-loss-percentage": ["error_packets"],
  // Add other chart specs here as needed
};

function showLoader() {
  const loaderWrapper = document.querySelector(".loader-wrapper");
  loaderWrapper.style.display = "flex"; // Show loader wrapper with flexbox
}

function hideLoader() {
  const loaderWrapper = document.querySelector(".loader-wrapper");
  loaderWrapper.style.display = "none"; // Hide loader wrapper
}

// Render the historic charts
async function renderHistoricCharts() {
  console.log("Fetching historic data...");
  showLoader();
  const data = await fetchData(`/historic`);
  const sensorData = data.data;
  hideLoader();

  // Temporary object to display in the API schema
  const tempHistoricDataExample = {
    data: [
      sensorData[0], // Include the first index of the fetched data
      { note: "/* More entries follow, structured as the first index. */" },
    ],
  };

  // Display the historic API schema with the temporary data
  displayHistoricApiSchema(tempHistoricDataExample);

  // Create chart containers dynamically
  createChartContainers(chartSpecs);

  updateCharts(sensorData);
}

async function updateCharts(sensorData) {
  console.log("Fetching new data for charts...");
  const currentTime = Math.floor(Date.now() / 1000);
  const twentyFourHoursAgo = currentTime - 24 * 60 * 60;
  // const data = await fetchData(`/historic?start-timestamp=${twentyFourHoursAgo}&end-timestamp=${currentTime}`);
  const data = await fetchData(`/historic`);
  sensorData = data.data;

  // Prepare data for percent packet loss
  const expectedPacketsPer15Min = (15 * 60) / 2.5;
  const percentPacketLoss = sensorData.map((entry) => {
    const actualPackets = expectedPacketsPer15Min - entry["error_packets"];
    return (
      ((expectedPacketsPer15Min - actualPackets) / expectedPacketsPer15Min) *
      100
    );
  });

  for (const [chartName, metrics] of Object.entries(chartSpecs)) {
    // Prepare the chart element ID based on the HTML
    const chartElementId = `historic-chart-${chartName}`;

    // Generate the traces for Plotly
    let traces;
    if (chartName === "rainfall_daily") {
      const dailyRainfall = aggregateRainfallByDay(sensorData);
      traces = [
        {
          x: dailyRainfall.map((entry) => entry.date),
          y: dailyRainfall.map((entry) => entry.totalRainfall),
          type: "bar",
          name: "Rainfall (mm)",
          text: dailyRainfall.map(
            (entry) => `Rainfall: ${entry.totalRainfall.toFixed(2)} mm`
          ),
          hoverinfo: "text+x",
        },
      ];
    } else if (chartName === "packet-loss") {
      traces = [
        {
          x: sensorData.map((entry) => new Date(entry.ts * 1000)),
          y: percentPacketLoss,
          mode: "lines",
          name: "Packet Loss (%)",
        },
      ];
    } else if (chartName === "wind-angle") {
      // Handle wind direction separately due to wrap-around
      traces = metrics.map((metric) => {
        const adjustedData = sensorData.map((entry, index, array) => {
          // If the difference between this and the last entry is more than 180,
          // insert a null to break the line
          if (
            index > 0 &&
            Math.abs(entry[metric] - array[index - 1][metric]) > 180
          ) {
            return null;
          }
          return entry[metric];
        });

        return {
          x: sensorData.map((entry) => new Date(entry.ts * 1000)),
          y: adjustedData,
          mode: "lines", // Optional: add markers for clarity
          name: metric.replace("_", " ").toUpperCase(),
          connectgaps: false, // Prevent connecting the gaps with lines
        };
      });
    } else if (chartName === "rainfall_hourly") {
      const hourlyRainfall = aggregateRainfallByHour(sensorData);
      traces = [
        {
          x: hourlyRainfall.map((entry) => new Date(entry.timestamp * 1000)),
          y: hourlyRainfall.map((entry) => entry.totalRainfall),
          type: "bar", // Use bar chart for rainfall
          name: "Rainfall (mm)",
          text: hourlyRainfall.map(
            (entry) => `Rainfall: ${entry.totalRainfall.toFixed(2)} mm`
          ), // Tooltip text
          hoverinfo: "text+x", // Show custom text and x values on hover
        },
      ];
    } else {
      traces = metrics.map((metric) => {
        let transformedData;
        if (metric === "battery_voltage") {
          transformedData = sensorData.map((entry) => entry[metric] / 10);
        } else if (metric === "input_voltage") {
          transformedData = sensorData.map((entry) => entry[metric] / 1000);
        } else {
          transformedData = sensorData.map((entry) => entry[metric]);
        }

        return {
          x: sensorData.map((entry) => new Date(entry.ts * 1000)),
          y: transformedData,
          mode: "lines",
          name: metric.replace("_", " ").toUpperCase(),
        };
      });
    }

    // Layout settings
    const layout = {
      paper_bgcolor: "transparent",
      plot_bgcolor: "#333",
      font: { color: "#fff", family: "Gotham Book, Arial, sans-serif" },
      xaxis: {
        gridcolor: "#888",
        title: {
          font: {
            family: "Gotham Black, Arial, sans-serif",
          },
        },
      },
      yaxis: {
        gridcolor: "#888",
        title: {
          font: {
            family: "Gotham Black, Arial, sans-serif",
          },
        },
      },
      showlegend: false,
      title: {
        text: formatChartTitle(chartName), // Set the title text
        font: {
          family: "Gotham Book, Arial, sans-serif",
          color: "#fff",
        },
      },
      margin: {
        l: 30, // left margin
        r: 15, // right margin
        b: 30, // bottom margin
        t: 35, // top margin
      },
      responsive: true,
    };

    // Check if the chart instance already exists
    if (chartInstances[chartName]) {
      // Update the existing chart
      Plotly.update(chartElementId, traces, layout);
    } else {
      // Create a new chart and store its instance
      Plotly.newPlot(chartElementId, traces, layout).then((chart) => {
        chartInstances[chartName] = chart;
      });
    }
  }
}

function aggregateRainfallByHour(sensorData) {
  let hourlyData = {};
  sensorData.forEach((entry) => {
    const hourTimestamp = Math.floor(entry.ts / 3600) * 3600; // Round down to the nearest hour
    if (!hourlyData[hourTimestamp]) {
      hourlyData[hourTimestamp] = {
        totalRainfall: 0,
        timestamp: hourTimestamp,
      };
    }
    hourlyData[hourTimestamp].totalRainfall += entry.rainfall_mm;
  });
  return Object.values(hourlyData);
}

function aggregateRainfallByDay(sensorData) {
  let dailyData = {};
  sensorData.forEach((entry) => {
    // Convert UTC timestamp to local date
    const date = new Date(entry.ts * 1000);
    // Create a date string unique to each day in the local timezone
    const dayKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

    if (!dailyData[dayKey]) {
      dailyData[dayKey] = {
        totalRainfall: 0,
        date: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
      };
    }
    dailyData[dayKey].totalRainfall += entry.rainfall_mm;
  });
  return Object.values(dailyData);
}

// Function to format chart titles into Title Case
function formatChartTitle(chartName) {
  return chartName
    // Replace underscores and hyphens with spaces
    .replace(/[_-]/g, " ")
    // Split the string into words
    .split(" ")
    // Capitalize the first letter of each word and join them back
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

window.addEventListener("load", () => {
  // Clear existing intervals
  clearInterval(currentDataInterval);
  clearInterval(historicDataInterval);

  // Function to generate a random number between 17 and 37
  const getRandomDelay = () => Math.floor(Math.random() * (50 - 40 + 1)) + 50;

  // Function to set the next fetch interval
  const setNextFetch = () => {
    let now = new Date();
    let randomDelay = getRandomDelay();
    let delay =
      ((5 - (now.getMinutes() % 5)) * 60 + randomDelay - now.getSeconds()) *
      1000 +
      0.1;

    setTimeout(() => {
      renderCurrentData();
      setNextFetch(); // Set the next fetch interval
    }, delay);
  };

  // Initial render
  renderCurrentData();
  renderHistoricCharts();

  // Set the first fetch interval
  setNextFetch();

  // Update "Data Age" every second based on the lastFetchedTS value
  setInterval(() => {
    updateTimeSinceLastUpdate(lastFetchedTS);
  }, 1000);

  // Update historic data every ten minutes
  historicDataInterval = setInterval(renderHistoricCharts, 600000);
});
