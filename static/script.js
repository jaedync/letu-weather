function plotGraph(data, elementId, title, xaxisTitle, yaxisTitle) {
    const trace = {
        type: 'scatter',
        mode: 'lines',
        x: data.map(d => new Date(d.ts * 1000)),  // Note the change here
        y: data.map(d => d.value),  // You will need to adapt this based on actual keys in data
        line: {color: '#17BECF'}
    };

    const layout = {
        title: title,
        xaxis: {
            title: xaxisTitle
        },
        yaxis: {
            title: yaxisTitle
        }
    };

    Plotly.newPlot(elementId, [trace], layout);
}

document.addEventListener("DOMContentLoaded", function() {
    // Fetch current data
    fetch("/current")
    .then(response => response.json())
    .then(data => {
        console.log("Current Data:", data);
        data.sensors.forEach(sensor => {
            const sensorData = sensor.data[0];
            for (const [key, value] of Object.entries(sensorData)) {
                const div = document.createElement('div');
                div.className = 'current-value';
                div.innerHTML = `<h3>${key.replace('_', ' ').toUpperCase()}</h3><p>${value}</p>`;
                document.getElementById("current-values").appendChild(div);
            }
        });
    })
    .catch(error => console.error("Error fetching current data:", error));

    fetch(`/historic`)
    .then(response => response.json())
    .then(data => {
        console.log("Historic Data:", data);
        data.sensors.forEach((sensor, sensorIndex) => {
            const dataArr = sensor.data;
            const sensorDataKeys = Object.keys(dataArr[0]);
            sensorDataKeys.forEach((key, keyIndex) => {
                const plotId = `plot-${sensorIndex}-${keyIndex}`;
                const div = document.createElement('div');
                div.id = plotId;
                document.getElementById("historic-values").appendChild(div);
                
                const plotData = dataArr.map(d => ({ ts: d.ts, value: d[key] }));
                plotGraph(plotData, plotId, `${key.replace('_', ' ').toUpperCase()} Over Time`, 'Time', key);
            });
        });
    })
    .catch(error => console.error("Error fetching historic data:", error));
});
