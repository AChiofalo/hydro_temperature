const API_BASE = window.location.origin; // Same origin as served file
// For development (if not served by FastAPI) use: 
// const API_BASE = "http://localhost:8000"; 

let chartInstance = null;
let currentRange = '24h';
let lastHistoryTs = 0; // Track the timestamp of the last data point on the chart

document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
});

async function initDashboard() {
    await fetchLatest();
    await fetchMonthly();
    await loadHistory('24h');

    // Auto-refresh data every 30s
    setInterval(updateDashboard, 30000);
}

// Global update function
async function updateDashboard() {
    console.log("Updating dashboard...");
    await fetchLatest();
    await fetchMonthly(); // Monthly stats might change
    await appendHistory(); // Only fetch and append new data
}

// Update Status Indicator
function setStatus(online) {
    const el = document.getElementById('connectionStatus');
    if (!el) return;

    if (online) {
        el.style.color = 'var(--success)';
        el.style.backgroundColor = 'rgba(46, 160, 67, 0.15)';
        el.innerHTML = '<span class="dot"></span> Online';
        const dot = el.querySelector('.dot');
        if (dot) {
            dot.style.backgroundColor = 'var(--success)';
            dot.style.boxShadow = '0 0 8px var(--success)';
        }
    } else {
        el.style.color = '#da3633'; // Red
        el.style.backgroundColor = 'rgba(218, 54, 51, 0.15)';
        el.innerHTML = '<span class="dot"></span> Offline';
        const dot = el.querySelector('.dot');
        if (dot) {
            dot.style.backgroundColor = '#da3633';
            dot.style.boxShadow = 'none';
        }
    }
}

// Fetch Latest Data
async function fetchLatest() {
    try {
        const res = await fetch(`${API_BASE}/climate/latest`);
        if (!res.ok) throw new Error("Network response was not ok");
        const data = await res.json();

        if (data.temperature !== undefined) {
            document.getElementById('currentTemp').textContent = data.temperature;
            document.getElementById('currentHum').textContent = data.humidity;
            const date = new Date(data.ts * 1000);
            document.getElementById('lastUpdate').textContent = date.toLocaleString('it-IT');
            setStatus(true);
        }
    } catch (err) {
        console.error("Latest fetch error:", err);
        setStatus(false);
    }
}

// Fetch Monthly Data
async function fetchMonthly() {
    try {
        const res = await fetch(`${API_BASE}/climate/monthly`);
        const data = await res.json();
        const tbody = document.getElementById('monthlyTableBody');
        tbody.innerHTML = '';

        data.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${row.month}</td>
                <td>${row.avg_temp}°C</td>
                <td>${row.min_temp}° / ${row.max_temp}°</td>
                <td>${row.avg_hum}%</td>
                <td>${row.min_hum}% / ${row.max_hum}%</td>
                <td>${row.record_count}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error("Monthly fetch error:", err);
    }
}

// Load Full History Graph
async function loadHistory(range) {
    currentRange = range;

    // Update buttons
    document.querySelectorAll('.controls .btn').forEach(btn => btn.classList.remove('active'));
    if (event && event.target) event.target.classList.add('active');

    // Calculate timestamp
    const now = Math.floor(Date.now() / 1000);
    let startTs = 0;

    if (range === '24h') startTs = now - (24 * 3600);
    if (range === '7d') startTs = now - (7 * 24 * 3600);
    if (range === '30d') startTs = now - (30 * 24 * 3600);

    try {
        const res = await fetch(`${API_BASE}/climate/history?start_ts=${startTs}`);
        const data = await res.json();

        if (data.length > 0) {
            lastHistoryTs = data[data.length - 1].ts; // Update last TS
        }

        renderChart(data);
    } catch (err) {
        console.error("History fetch error:", err);
    }
}

// Append New Data to History Graph
async function appendHistory() {
    if (!chartInstance) return;

    // Fetch data newer than the last known timestamp
    const nextTs = lastHistoryTs + 1;

    try {
        // We only want new data, so start_ts is strict
        const res = await fetch(`${API_BASE}/climate/history?start_ts=${nextTs}`);
        const newData = await res.json();

        if (newData.length === 0) return;

        console.log(`Appending ${newData.length} new records.`);

        // Updating local state
        lastHistoryTs = newData[newData.length - 1].ts;

        // Append to Chart.js
        const newLabels = newData.map(d => d.ts * 1000);
        const newTemps = newData.map(d => d.temperature);
        const newHums = newData.map(d => d.humidity);

        chartInstance.data.labels.push(...newLabels);
        chartInstance.data.datasets[0].data.push(...newTemps);
        chartInstance.data.datasets[1].data.push(...newHums);

        // Optional: Remove old data points if they fall out of window (e.g. for 24h view)
        // For now, we simply keep adding to avoid complex sliding window logic bugs

        chartInstance.update();

    } catch (err) {
        console.error("Append history error:", err);
    }
}

function renderChart(data) {
    const ctx = document.getElementById('historyChart').getContext('2d');

    const labels = data.map(d => d.ts * 1000); // ms for Luxon
    const temps = data.map(d => d.temperature);
    const hums = data.map(d => d.humidity);

    if (chartInstance) {
        chartInstance.destroy();
    }

    // Gradients
    const gradientTemp = ctx.createLinearGradient(0, 0, 0, 400);
    gradientTemp.addColorStop(0, 'rgba(47, 129, 247, 0.5)');
    gradientTemp.addColorStop(1, 'rgba(47, 129, 247, 0.0)');

    const gradientHum = ctx.createLinearGradient(0, 0, 0, 400);
    gradientHum.addColorStop(0, 'rgba(163, 113, 247, 0.5)');
    gradientHum.addColorStop(1, 'rgba(163, 113, 247, 0.0)');

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Temperatura (°C)',
                    data: temps,
                    borderColor: '#2f81f7', // Blue
                    backgroundColor: gradientTemp,
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    fill: true,
                    yAxisID: 'y'
                },
                {
                    label: 'Umidità (%)',
                    data: hums,
                    borderColor: '#a371f7', // Purple
                    backgroundColor: gradientHum,
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    fill: true,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    labels: { color: '#8b949e' }
                },
                tooltip: {
                    backgroundColor: 'rgba(22, 27, 34, 0.9)',
                    titleColor: '#f0f6fc',
                    bodyColor: '#8b949e',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: currentRange === '24h' ? 'hour' : 'day',
                        displayFormats: {
                            hour: 'HH:mm',
                            day: 'dd MMM'
                        }
                    },
                    grid: {
                        color: 'rgba(255,255,255,0.05)'
                    },
                    ticks: { color: '#8b949e' }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#8b949e' }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    grid: { display: false },
                    ticks: { color: '#8b949e' }
                }
            }
        }
    });
}
