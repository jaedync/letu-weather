// Global variables
let currentDataInterval, historicDataInterval;
let barometerChart, humidityChart, temperatureChart, wetBulbChart, windSpeedChart, windDirChart;
// Global variables to keep track of chart instances
const chartInstances = {};
let lastFetchedTS = 0;  // This will hold the last fetched current 'ts' value

function replaceTextInDOM(node, searchText, replaceText) {
    if (node.nodeType === Node.TEXT_NODE) {
        if (node.nodeValue.includes(searchText)) {
            node.nodeValue = node.nodeValue.replace(new RegExp(searchText, 'g'), replaceText);
        }
    } else {
        for (let child of node.childNodes) {
            replaceTextInDOM(child, searchText, replaceText);
        }
    }
}
window.onload = () => {
    const hostName = window.location.hostname;
    replaceTextInDOM(document.body, 'example.com', hostName);
};

document.getElementById('infoButton').onclick = function() {
    document.getElementById('infoModal').style.display = 'block';
}

document.querySelector('.close-button').onclick = function() {
    document.getElementById('infoModal').style.display = 'none';
}

// Optionally, to close the modal when clicking outside of it
window.onclick = function(event) {
    let modal = document.getElementById('infoModal');
    if (event.target == modal) {
        modal.style.display = 'none';
        document.querySelector('.container').classList.remove('active'); // Remove blur effect
    }
}

let infoButtonTimer;

function resetInfoButtonTimer() {
    clearTimeout(infoButtonTimer); // Clear existing timer
    document.getElementById('infoButton').style.opacity = '1'; // Make button fully visible
    infoButtonTimer = setTimeout(() => {
        document.getElementById('infoButton').style.opacity = '0'; // Fade out the button
    }, 5000); // Time in milliseconds before the button fades out
}

// Initialize the timer when the page loads
resetInfoButtonTimer();

// Restart the timer whenever the user interacts with the button
document.getElementById('infoButton').addEventListener('click', () => {
    resetInfoButtonTimer();
    // Add any additional logic for when the button is clicked
});

// Optionally, reset the timer when the user moves the mouse within the container
document.querySelector('.container').addEventListener('mousemove', () => {
    resetInfoButtonTimer();
});

// This function formats and displays the API schema in the modal.
function displayApiSchemaExample(currentData) {
    const apiSchemaElement = document.getElementById('api-schema-example');
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
    const apiSchemaElement = document.getElementById('api-schema-example-historic');
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
function createCard(title, value, isWindDirection = false, rotationDegree = 0) {
    const card = document.createElement('div');
    card.className = 'card';
    let contentHTML = `
        <h3>${title}</h3>
        <p>${value}</p>`;

    if (isWindDirection) {
        // Include the rotation directly in the style attribute
        contentHTML = `
            <h3>${title}</h3>
            <div class="wind-direction-content">
                <p>${value}</p>
                <img class="compass-icon" src="/static/pointer.svg" alt="Compass" style="transform: rotate(${rotationDegree}deg);" />
            </div>`;
    }
    
    card.innerHTML = contentHTML;
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
    document.getElementById('data-age').textContent = `Data Age: ${ageMinutes}m ${ageSeconds}s`;
}

// Render the current data section
async function renderCurrentData() {
    console.log("Fetching current data...");
    const data = await fetchData('/current');
    displayApiSchemaExample(data);
    const sensor1Data = data.data[0];
    const sensor2Data = data.data[1];
    lastFetchedTS = sensor1Data.ts;
    updateImportantMetrics(sensor1Data);
    updateOtherMetrics(sensor1Data, sensor2Data);
}

// Map temperature to a color
function getColorForTemperature(value) {
    let red = 0, green = 0, blue = 0;
    if (value < 32) {
        blue = 255;
    } else if (value >= 32 && value < 60) {
        blue = Math.floor(255 - ((value - 32) * (255 - 0) / (60 - 32)));
        green = Math.floor((value - 32) * (255 - 0) / (60 - 32));
    } else if (value >= 60 && value < 80) {
        green = 255;
        red = Math.floor((value - 60) * (255 - 0) / (80 - 60));
    } else if (value >= 80 && value < 90) {
        red = 255;
        green = Math.floor(255 - ((value - 80) * (255 - 0) / (90 - 80)));
    } else {
        red = 255;
    }
    return `rgba(${red}, ${green}, ${blue}, 0.2)`;
}

// Map humidity to a color
function getColorForHumidity(value) {
    let red = 0, green = 0, blue = 0;
    
    if (value < 40) {
        // Dark brown to light brown
        red = 139 + Math.floor((value / 40) * (222 - 139));
        green = 69 + Math.floor((value / 40) * (184 - 69));
        blue = 19 + Math.floor((value / 40) * (135 - 19));
    } else if (value >= 40 && value < 60) {
        // Light brown to light green
        red = 222 - Math.floor(((value - 40) / 20) * (222 - 144));
        green = 184 - Math.floor(((value - 40) / 20) * (184 - 238));
        blue = 135 - Math.floor(((value - 40) / 20) * (135 - 144));
    } else {
        // Light green to dark blue
        red = 144 - Math.floor(((value - 60) / 40) * 144);
        green = 238 - Math.floor(((value - 60) / 40) * 238);
        blue = 144 + Math.floor(((value - 60) / 40) * (255 - 144));
    }
    
    return `rgba(${red}, ${green}, ${blue}, 0.2)`;
}

function getBackgroundColorForMetric(label, value) {
    let color = '';
    let borderColor = '';
    switch (label) {
        case 'Temperature':
            color = getColorForTemperature(value);
            borderColor = color.replace('0.2', '1');
            break;
        case 'Humidity':
            color = getColorForHumidity(value);
            borderColor = color.replace('0.2', '1');
            break;
        case 'Wind Speed':
        case 'Wind Gusts':
            if (value < 3) {
                color = 'rgba(57, 255, 20, 0.2)'; // neon green
                borderColor = 'rgba(57, 255, 20, 1)'; // neon green border
            } else if (value >= 3 && value < 6) {
                color = 'rgba(0, 255, 0, 0.2)'; // green
                borderColor = 'rgba(0, 255, 0, 1)'; // green border
            } else if (value >= 6 && value < 9) {
                color = 'rgba(255, 255, 0, 0.2)'; // yellow
                borderColor = 'rgba(255, 255, 0, 1)'; // yellow border
            } else if (value >= 9 && value <= 12) {
                color = 'rgba(255, 165, 0, 0.4)'; // orange
                borderColor = 'rgba(255, 165, 0, 1)'; // orange border
            } else {
                color = 'rgba(255, 0, 0, 0.2)'; // red
                borderColor = 'rgba(255, 0, 0, 1)'; // red border
            }
        break;
                
        default:
            color = 'rgba(114, 137, 218, 0.5)';  // Lighter slate blue as default
            borderColor = 'rgba(114, 137, 218, 1)';  // Lighter slate blue border as default
    }
    return { color, borderColor };
}

function updateImportantMetrics(sensorData) {
    const importantMetricsDiv = document.querySelector('.important-metrics');
    importantMetricsDiv.innerHTML = ''; // Clear any existing content

    const importantMetricsLeftDiv = document.createElement('div');
    importantMetricsLeftDiv.className = 'important-metrics-left';

    const importantMetricsRightDiv = document.createElement('div');
    importantMetricsRightDiv.className = 'important-metrics-right';

    const divider = document.createElement('div');
    divider.className = 'important-metrics-divider';

    const metrics = [
        { label: 'Temperature', value: `${parseFloat(sensorData.temp).toFixed(1)}°F` },
        { label: 'Wind Speed', value: `${parseFloat(sensorData.wind_speed_avg_last_10_min).toFixed(1)} MPH` },
        { label: 'Wind Gusts', value: `${parseFloat(sensorData.wind_speed_hi_last_10_min)} MPH` },
        { label: 'Humidity', value: `${parseFloat(sensorData.hum).toFixed(1)}%` },
    ];  

    // Create or update the metrics
    metrics.forEach(({ label, value }) => {
        let metricElement = document.createElement('div');
        metricElement.className = 'important-metrics-card';
        metricElement.innerHTML = `
            <div class="important-label">${label}</div>
            <div class="important-value">${value}</div>
        `;

        // Apply background color based on the value
        const { color, borderColor } = getBackgroundColorForMetric(label, parseFloat(value));
        metricElement.style.backgroundColor = color;
        metricElement.style.borderColor = borderColor;

        // Add attention-grabbing class for wind conditions at or over 10 MPH
        if ((label === 'Wind Speed' || label === 'Wind Gusts') && parseFloat(value) >= 12) {
        metricElement.classList.add('attention-grabbing');
        } else {
        metricElement.classList.remove('attention-grabbing');
        }

        // Append to the left or right div based on the metric label
        if (label === 'Temperature' || label === 'Humidity') {
            importantMetricsLeftDiv.appendChild(metricElement);
        } else {
            importantMetricsRightDiv.appendChild(metricElement);
        }
    });

    importantMetricsDiv.appendChild(importantMetricsLeftDiv);
    importantMetricsDiv.appendChild(divider);
    importantMetricsDiv.appendChild(importantMetricsRightDiv);
}

// Function to calculate the start time from the current timestamp and uptime, then format it
function calculateStartTime(currentTimestamp, uptimeSeconds) {
    const startTime = currentTimestamp - uptimeSeconds;
    return unixToHumanReadable(startTime);
}

// Function to convert Unix timestamp to human-readable format
function unixToHumanReadable(unixTimestamp) {
    const date = new Date(unixTimestamp * 1000);
    const aWeekAgo = new Date();
    aWeekAgo.setDate(aWeekAgo.getDate() - 7); // Set to 7 days ago

    // Check if the given date is more than a week old
    if (date < aWeekAgo) {
        // If more than a week old, return only the date part
        return date.toLocaleDateString();
    } else {
        // If within the last week, return the full date and time
        return date.toLocaleString();
    }
}

function getPreciseCardinalDirection(degree) {
    // Normalize the degree to be within 0-359
    degree = degree % 360;
    if (degree < 0) {
        degree += 360; // Handle negative degrees
    }

    const directions = [
        'N', 'NNE', 'NE', 'ENE', 
        'E', 'ESE', 'SE', 'SSE',
        'S', 'SSW', 'SW', 'WSW', 
        'W', 'WNW', 'NW', 'NNW'
    ];

    const index = Math.round(degree / 22.5) % 16;
    return directions[index];
}

function updateOtherMetrics(sensorData, auxiliaryData) {
    const currentDataDiv = document.getElementById('current-data');
    const fragment = document.createDocumentFragment();
    const ts = auxiliaryData.ts;
    
    // sensor metrics
    const metrics = ['bar_absolute', 'uv_index', 'solar_rad', 'dew_point', 'wind_chill', 'heat_index', 'thw_index'];
    const aestheticLabels = ['Barometric Pressure', 'UV Index', 'Solar Radiation', 'Dew Point', 'Wind Chill', 'Heat Index', 'THW Index'];
    const units = ['inHg', '', 'W/m²', '°F', '°F', '°F', '°F'];

    // auxiliary metrics
    const auxiliaryMetrics = ['input_voltage', 'wifi_rssi', 'link_uptime', 'uptime'];
    const auxiliaryLabels = ['Input Voltage', 'Uplink WiFi RSSI', 'Last Uplink Boot', 'Last Station Boot'];
    const auxiliaryUnits = ['V', 'dBm', '', ''];

    // Combine both sets of metrics
    const combinedMetrics = metrics.concat(auxiliaryMetrics);
    const combinedLabels = aestheticLabels.concat(auxiliaryLabels);
    const combinedUnits = units.concat(auxiliaryUnits);

    combinedMetrics.forEach((metric, index) => {
        let value;
        // Extract the value from the appropriate data source
        if (metrics.includes(metric)) {
            value = sensorData[metric];
        } else {
            value = auxiliaryData[metric];
        }

        // Format value for UV index and Fahrenheit metrics
        if (metric === 'uv_index' || metric === 'dew_point' || metric === 'wind_chill' || metric === 'heat_index' || metric === 'thw_index') {
            value = parseFloat(value).toFixed(1); // Ensure one decimal place
        } else if (metric === 'input_voltage') {
            value = (value / 1000).toFixed(2); // Divides by 1000 for input voltage
        } else if (metric === 'link_uptime' || metric === 'uptime') {
            value = calculateStartTime(ts, value); // Calculates start time and formats it
        }

        const valueWithUnit = value + (combinedUnits[index] ? ` ${combinedUnits[index]}` : '');
        fragment.appendChild(createCard(combinedLabels[index], valueWithUnit));
    });

    // Get the rotation degree for the compass
    const rotationDegree = sensorData.wind_dir_scalar_avg_last_10_min;
    
    // Create or update the wind direction card with rotation
    const cardinalDirection = getPreciseCardinalDirection(rotationDegree);
    const windDirectionValue = `${cardinalDirection} ${rotationDegree}°`;
    const windDirectionCard = createCard('Wind Direction', windDirectionValue, true, rotationDegree);

    // Update the DOM
    currentDataDiv.innerHTML = '';
    currentDataDiv.appendChild(windDirectionCard);
    currentDataDiv.appendChild(fragment);
}

function createChartContainers(chartSpecs) {
    const chartsContainer = document.getElementById('charts-container');
    chartsContainer.innerHTML = ''; // Clear existing chart containers

    Object.keys(chartSpecs).forEach(chartName => {
        const chartCardDiv = document.createElement('div');
        chartCardDiv.className = 'chart-card';

        const chartDiv = document.createElement('div');
        chartDiv.id = `historic-chart-${chartName}`;

        chartCardDiv.appendChild(chartDiv);
        chartsContainer.appendChild(chartCardDiv);
    });
}

const chartSpecs = {
    // 'all': ['wind_speed_avg', 'wind_speed_hi', 'temp_avg', 'hum_hi', 'bar_absolute', 'dew_point_hi', 'wet_bulb_hi', 'uv_index_avg'],
    'temperature': ['temp_avg', 'temp_hi', 'temp_lo'],
    'humidity': ['hum_hi', 'hum_lo'],
    'wind-speed': ['wind_speed_avg', 'wind_speed_hi'],
    'wind-angle': ['wind_speed_hi_dir', 'wind_dir_of_prevail'],
    'barometer': ['bar_absolute', 'bar_hi', 'bar_lo', 'bar_sea_level'],
    'solar': ['solar_rad_avg', 'solar_rad_hi'],

    'dew-point': ['dew_point_hi', 'dew_point_last', 'dew_point_lo'],
    'wet-bulb': ['wet_bulb_hi', 'wet_bulb_last', 'wet_bulb_lo'],
    'uv-index': ['uv_index_avg', 'uv_index_hi'],
    'battery-voltage': ['battery_voltage'],
    'input-voltage': ['input_voltage'],
    'signals-strengths': ['wifi_rssi', 'rssi'],
    'packet-loss-percentage': ['error_packets'],
    // Add other chart specs here as needed
};

function showLoader() {
    const loaderWrapper = document.querySelector('.loader-wrapper');
    loaderWrapper.style.display = 'flex'; // Show loader wrapper with flexbox
}

function hideLoader() {
    const loaderWrapper = document.querySelector('.loader-wrapper');
    loaderWrapper.style.display = 'none'; // Hide loader wrapper
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
        "data": [
            sensorData[0], // Include the first index of the fetched data
            { "note": "/* More entries follow, structured as the first index. */" }
        ]
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
    const percentPacketLoss = sensorData.map(entry => {
        const actualPackets = expectedPacketsPer15Min - entry['error_packets'];
        return ((expectedPacketsPer15Min - actualPackets) / expectedPacketsPer15Min) * 100;
    });

    for (const [chartName, metrics] of Object.entries(chartSpecs)) {
        // Prepare the chart element ID based on the HTML
        const chartElementId = `historic-chart-${chartName}`;

        // Generate the traces for Plotly
        let traces;
        if (chartName === 'packet-loss') {
            traces = [{
                x: sensorData.map(entry => new Date(entry.ts * 1000)),
                y: percentPacketLoss,
                mode: 'lines',
                name: 'Packet Loss (%)',
            }];
        } else if (chartName === 'wind-angle') {
            // Handle wind direction separately due to wrap-around
            traces = metrics.map(metric => {
                const adjustedData = sensorData.map((entry, index, array) => {
                    // If the difference between this and the last entry is more than 180,
                    // insert a null to break the line
                    if (index > 0 && Math.abs(entry[metric] - array[index - 1][metric]) > 180) {
                        return null;
                    }
                    return entry[metric];
                });

                return {
                    x: sensorData.map(entry => new Date(entry.ts * 1000)),
                    y: adjustedData,
                    mode: 'lines', // Optional: add markers for clarity
                    name: metric.replace('_', ' ').toUpperCase(),
                    connectgaps: false, // Prevent connecting the gaps with lines
                };
            });
        } else {
            traces = metrics.map(metric => {
                let transformedData;
                if (metric === 'battery_voltage') {
                    transformedData = sensorData.map(entry => entry[metric] / 10);
                } else if (metric === 'input_voltage') {
                    transformedData = sensorData.map(entry => entry[metric] / 1000);
                } else {
                    transformedData = sensorData.map(entry => entry[metric]);
                }

                return {
                    x: sensorData.map(entry => new Date(entry.ts * 1000)),
                    y: transformedData,
                    mode: 'lines',
                    name: metric.replace('_', ' ').toUpperCase(),
                };
            });
        }

        // Layout settings
        const layout = {
            paper_bgcolor: '#222',
            plot_bgcolor: '#333',
            font: { color: '#fff' },
            xaxis: { gridcolor: '#888' },
            yaxis: { gridcolor: '#888' },
            showlegend: false,
            title: formatChartTitle(chartName),
            margin: {
                l: 30, // left margin
                r: 30, // right margin
                b: 45, // bottom margin
                t: 55  // top margin
            },
            responsive: true
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

// Function to format chart titles into Title Case
function formatChartTitle(chartName) {
    return chartName
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

window.addEventListener('load', () => {
    // Clear existing intervals
    clearInterval(currentDataInterval);
    clearInterval(historicDataInterval);

    // Function to generate a random number between 17 and 37
    const getRandomDelay = () => Math.floor(Math.random() * (50 - 40 + 1)) + 50;

    // Function to set the next fetch interval
    const setNextFetch = () => {
        let now = new Date();
        let randomDelay = getRandomDelay();
        let delay = ((5 - (now.getMinutes() % 5)) * 60 + randomDelay - now.getSeconds()) * 1000;

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
