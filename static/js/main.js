// Global variables
let currentDataInterval, historicDataInterval;
let barometerChart, humidityChart, temperatureChart, wetBulbChart, windSpeedChart, windDirChart;
// Global variables to keep track of chart instances
const chartInstances = {};
let lastFetchedTS = 0;  // This will hold the last fetched 'ts' value

// Helper function to create a single card
function createCard(title, value) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
        <h3>${title}</h3>
        <p>${value}</p>`;
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
    // console.log("Current data:", JSON.stringify(data, null, 2));  // Log the entire data to console
    const sensor1Data = data.data[0];
    lastFetchedTS = sensor1Data.ts;  // Set the global variable here
    updateImportantMetrics(sensor1Data);
    updateOtherMetrics(sensor1Data);
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

// function addDinoImageToCard(metricElement) {
//     const dinoImg = document.createElement('img');
//     dinoImg.src = "https://cdn.discordapp.com/attachments/1099561426059800626/1168592018121961623/IMG_0275.gif?ex=655b8da0&is=654918a0&hm=802119c9b085a3298419099c58559750d7105561ef26e7be2fff93a522c6fcbd";
//     dinoImg.className = 'dino-image';
//     metricElement.appendChild(dinoImg);
// }

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
        
        // if ((label === 'Wind Speed' || label === 'Wind Gusts') && parseFloat(value) === 0) {
        //     addDinoImageToCard(metricElement);
        // }
    

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

function unixToHumanReadable(unixTimestamp) {
    const date = new Date(unixTimestamp * 1000);
    return date.toLocaleString();  // Convert to local date string
}

function updateOtherMetrics(sensorData) {
    const currentDataDiv = document.getElementById('current-data');
    const fragment = document.createDocumentFragment();
    const metrics = ['bar_absolute', 'dew_point', 'solar_rad', 'uv_index', 'thw_index', 'wind_chill', 'heat_index', 'wind_dir_scalar_avg_last_10_min', 'rainfall_year_in', 'rainfall_monthly_in', 'rainfall_last_24_hr_in', 'rainfall_last_60_min_in', 'wet_bulb', 'rain_storm_last_in'];

    // Loop over each metric to create a card
    metrics.forEach(metric => {
        fragment.appendChild(createCard(metric.replace(/_/g, ' ').toUpperCase(), sensorData[metric]));
    });

    // Add the rainstorm start and end times
    fragment.appendChild(createCard('Rainstorm Last Start', unixToHumanReadable(sensorData['rain_storm_last_start_at'])));
    fragment.appendChild(createCard('Rainstorm Last End', unixToHumanReadable(sensorData['rain_storm_last_end_at'])));
    
    // Update the DOM
    currentDataDiv.innerHTML = '';
    currentDataDiv.appendChild(fragment);
}

// Render the historic charts
async function renderHistoricCharts() {
    console.log("Fetching historic data...");
    const currentTime = Math.floor(Date.now() / 1000);
    const twentyFourHoursAgo = currentTime - 7 * 24 * 60 * 60;
    // const data = await fetchData(`/historic?start-timestamp=${twentyFourHoursAgo}&end-timestamp=${currentTime}`);
    const data = await fetchData(`/historic`);
    // console.log("Historic data:", JSON.stringify(data, null, 2));  // Log the entire data to console
    const sensorData = data.data;  // Note the change here, data is now under the "data" key
    updateCharts(sensorData);
}

async function updateCharts(sensorData) {
    console.log("Fetching new data for charts...");
    const currentTime = Math.floor(Date.now() / 1000);
    const twentyFourHoursAgo = currentTime - 24 * 60 * 60;
    // const data = await fetchData(`/historic?start-timestamp=${twentyFourHoursAgo}&end-timestamp=${currentTime}`);
    const data = await fetchData(`/historic`);
    sensorData = data.data;
    const chartSpecs = {
        'all': ['wind_speed_avg', 'wind_speed_hi', 'temp_avg', 'hum_hi', 'bar_absolute', 'dew_point_hi', 'wet_bulb_hi', 'uv_index_avg'],
        'wind-speed': ['wind_speed_avg', 'wind_speed_hi'],
        'temperature': ['temp_avg', 'temp_hi', 'temp_lo'],
        'humidity': ['hum_hi', 'hum_lo'],
        'barometer': ['bar_absolute', 'bar_hi', 'bar_lo', 'bar_sea_level'],
        'solar': ['solar_rad_avg', 'solar_rad_hi'],
        'wind-angle': ['wind_speed_hi_dir', 'wind_dir_of_prevail'],

        'dew-point': ['dew_point_hi', 'dew_point_last', 'dew_point_lo'],
        'wet-bulb': ['wet_bulb_hi', 'wet_bulb_last', 'wet_bulb_lo'],
        'uv-index': ['uv_index_avg', 'uv_index_hi'],
        'signals-strengths': ['wifi_rssi', 'rssi'],
        'packet-loss': ['error_packets'],
        // Add other chart specs here as needed
    };

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
        } else {
        traces = metrics.map(metric => ({
            x: sensorData.map(entry => new Date(entry.ts * 1000)),
            y: sensorData.map(entry => entry[metric]),
            mode: 'lines',
            name: metric.replace('_', ' ').toUpperCase(),
        }));
        }

        // Layout settings
        const layout = {
            paper_bgcolor: '#222',
            plot_bgcolor: '#333',
            font: { color: '#fff' },
            xaxis: { gridcolor: '#888' },
            yaxis: { gridcolor: '#888' },
            showlegend: false,
            title: chartName.replace('-', ' ').toUpperCase(),
            margin: {
                l: 30, // left margin
                r: 30, // right margin
                b: 45, // bottom margin
                t: 75  // top margin
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

// Initialize
// window.addEventListener('load', () => {
//     // Clear existing intervals
//     clearInterval(currentDataInterval);
//     clearInterval(historicDataInterval);

//     // Initial render
//     renderCurrentData();
//     renderHistoricCharts();

//     // Update current data every minute
//     currentDataInterval = setInterval(renderCurrentData, 60000);
    
//     // Update "Data Age" every second based on the lastFetchedTS value
//     setInterval(() => {
//         updateTimeSinceLastUpdate(lastFetchedTS);
//     }, 1000);

//     // Update historic data every ten minutes
//     historicDataInterval = setInterval(renderHistoricCharts, 600000);
// });

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
