// Global variables
let currentTab = 'query';
let policies = [];
let currentEditingId = null;
let confirmCallback = null;
let metricsChart = null;
let refreshInterval = null;

// API Configuration - Use direct Prometheus API calls
const API_BASE = window.location.origin;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApplication();
});

async function initializeApplication() {
    setupEventListeners();
    await checkApiHealth();
    
    // Initialize based on current tab
    switchTab('query');
    
    // Start periodic health checks
    setInterval(checkApiHealth, 30000);
    
    // Initialize Chart.js defaults
    if (typeof Chart !== 'undefined') {
        Chart.defaults.responsive = true;
        Chart.defaults.maintainAspectRatio = false;
    }
}

function setupEventListeners() {
    // Tab navigation
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const tabName = e.currentTarget.dataset.tab;
            switchTab(tabName);
        });
    });
    
    // Time range selector
    const timeRange = document.getElementById('timeRange');
    if (timeRange) {
        timeRange.addEventListener('change', handleTimeRangeChange);
    }
    
    // Results tab switcher
    document.querySelectorAll('.results-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            switchResultsFormat(e.currentTarget.dataset.format);
        });
    });
    
    // Form validation setup
    setupFormValidation();
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
    
    // Modal close on outside click
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            if (e.target.id === 'policyModal') closePolicyModal();
            if (e.target.id === 'confirmModal') closeConfirmModal();
        }
    });
}

// Tab Management
function switchTab(tabName) {
    currentTab = tabName;
    
    // Update active tab
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Update active content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    // Initialize tab-specific functionality
    initializeTab(tabName);
}

async function initializeTab(tabName) {
    switch(tabName) {
        case 'query':
            initializeQueryTab();
            break;
        case 'graph':
            initializeGraphTab();
            break;
        case 'alerts':
            await loadAlerts();
            break;
        case 'targets':
            await loadTargets();
            break;
        case 'retention':
            await loadPolicies();
            break;
        case 'config':
            await loadSystemStatus();
            break;
    }
}

// API Health Check
async function checkApiHealth() {
    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');
    
    try {
        const response = await fetch(`${API_BASE}/health`);
        const data = await response.json();
        
        if (data.status === 'healthy' && data.prometheus_connection?.status === 'connected') {
            statusIndicator.className = 'status-indicator connected';
            statusText.textContent = 'Connected';
        } else {
            statusIndicator.className = 'status-indicator error';
            statusText.textContent = 'API Error';
        }
    } catch (error) {
        statusIndicator.className = 'status-indicator error';
        statusText.textContent = 'Disconnected';
        console.error('Health check failed:', error);
    }
}

// Fixed API call function
// Fixed API call function in prometheus-ui.js
// Fixed API call function 
async function callPrometheusAPI(endpoint, params = {}) {
    try {
        // Map common endpoints to our direct proxy endpoints
        const endpointMap = {
            'query': 'prometheus-proxy/query',
            'query_range': 'prometheus-proxy/query-range', 
            'label/__name__/values': 'prometheus-proxy/metrics',
            'targets': 'prometheus-proxy/targets',
            'alerts': 'prometheus-proxy/alerts',
            'status/buildinfo': 'prometheus-proxy/status/buildinfo',
            'status/runtimeinfo': 'prometheus-proxy/status/runtimeinfo',
            'status/flags': 'prometheus-proxy/status/flags',
            'status/tsdb': 'prometheus-proxy/status/tsdb'
        };
        
        const mappedEndpoint = endpointMap[endpoint] || `api/v1/${endpoint}`;
        let url = `${API_BASE}/${mappedEndpoint}`;
        
        let method = 'GET';
        let body = null;
        
        // Handle query endpoints specially
        if (endpoint === 'query' && params.query) {
            method = 'POST';
            body = JSON.stringify({ query: params.query });
            url = `${API_BASE}/prometheus-proxy/query`;
        } else if (endpoint === 'query_range' && params.query) {
            // Handle range queries
            const searchParams = new URLSearchParams(params);
            url = `${API_BASE}/api/v1/query_range?${searchParams.toString()}`;
        } else if (Object.keys(params).length > 0 && method === 'GET') {
            const searchParams = new URLSearchParams(params);
            url += `?${searchParams.toString()}`;
        }
        
        const fetchOptions = {
            method: method,
            headers: {
                'Accept': 'application/json'
            }
        };
        
        if (body) {
            fetchOptions.headers['Content-Type'] = 'application/json';
            fetchOptions.body = body;
        }
        
        const response = await fetch(url, fetchOptions);
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        
        if (data.status && data.status !== 'success') {
            throw new Error(data.error || 'Unknown error from Prometheus');
        }
        
        return data;
    } catch (error) {
        console.error(`Prometheus API call failed (${endpoint}):`, error);
        throw error;
    }
}

// Fixed query execution
async function executeQuery() {
    const queryInput = document.getElementById('queryInput');
    const query = queryInput.value.trim();
    
    if (!query) {
        showToast('Warning', 'Please enter a query', 'warning');
        return;
    }
    
    showLoading('Executing query...');
    
    try {
        const data = await callPrometheusAPI('query', { query: query });
        displayQueryResults(data);
        
    } catch (error) {
        console.error('Query execution failed:', error);
        showToast('Error', `Query failed: ${error.message}`, 'error');
        displayQueryError(error.message);
    } finally {
        hideLoading();
    }
}

// Query Tab Functions
function initializeQueryTab() {
    const queryInput = document.getElementById('queryInput');
    if (queryInput) {
        queryInput.addEventListener('input', handleQueryInput);
        queryInput.addEventListener('keydown', handleQueryKeydown);
    }
}

function handleQueryInput(event) {
    const query = event.target.value;
    if (query.length > 2) {
        // Could implement query suggestions here
    }
}

function handleQueryKeydown(event) {
    if (event.ctrlKey && event.key === 'Enter') {
        executeQuery();
    }
}

async function executeQuery() {
    const queryInput = document.getElementById('queryInput');
    const query = queryInput.value.trim();
    
    if (!query) {
        showToast('Warning', 'Please enter a query', 'warning');
        return;
    }
    
    showLoading('Executing query...');
    
    try {
        const data = await callPrometheusAPI('query', { query: query });
        displayQueryResults(data);
        
    } catch (error) {
        console.error('Query execution failed:', error);
        showToast('Error', `Query failed: ${error.message}`, 'error');
        displayQueryError(error.message);
    } finally {
        hideLoading();
    }
}

function displayQueryResults(data) {
    const resultsContent = document.getElementById('resultsContent');
    
    if (!data || !data.data) {
        displayQueryError('No data returned from query');
        return;
    }
    
    if (data.data.result.length === 0) {
        resultsContent.innerHTML = `
            <div class="empty-results">
                <i class="fas fa-search"></i>
                <p>No results found</p>
            </div>
        `;
        return;
    }
    
    // Display based on current format
    const activeFormat = document.querySelector('.results-tab.active').dataset.format;
    
    if (activeFormat === 'table') {
        displayResultsAsTable(data.data.result);
    } else {
        displayResultsAsJson(data);
    }
}

function displayResultsAsTable(results) {
    const resultsContent = document.getElementById('resultsContent');
    
    const table = `
        <table class="results-table">
            <thead>
                <tr>
                    <th>Metric</th>
                    <th>Value</th>
                    <th>Timestamp</th>
                </tr>
            </thead>
            <tbody>
                ${results.map(result => `
                    <tr>
                        <td>
                            <code class="metric-pattern">${formatMetricName(result.metric)}</code>
                        </td>
                        <td><strong>${result.value[1]}</strong></td>
                        <td><span class="text-muted">${formatTimestamp(result.value[0])}</span></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    resultsContent.innerHTML = table;
}

function displayResultsAsJson(data) {
    const resultsContent = document.getElementById('resultsContent');
    resultsContent.innerHTML = `<pre class="json-display">${JSON.stringify(data, null, 2)}</pre>`;
}

function displayQueryError(error) {
    const resultsContent = document.getElementById('resultsContent');
    resultsContent.innerHTML = `
        <div class="empty-results">
            <i class="fas fa-exclamation-triangle" style="color: var(--danger-color);"></i>
            <p>Query Error: ${escapeHtml(error)}</p>
        </div>
    `;
}

function clearQuery() {
    document.getElementById('queryInput').value = '';
    document.getElementById('resultsContent').innerHTML = `
        <div class="empty-results">
            <i class="fas fa-search"></i>
            <p>Execute a query to see results</p>
        </div>
    `;
}

function switchResultsFormat(format) {
    document.querySelectorAll('.results-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-format="${format}"]`).classList.add('active');
}

// Graph Tab Functions
function initializeGraphTab() {
    if (!metricsChart) {
        initializeChart();
    }
}

function initializeChart() {
    const ctx = document.getElementById('metricsChart');
    if (ctx && typeof Chart !== 'undefined') {
        metricsChart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: []
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'time',
                        display: true,
                        title: {
                            display: true,
                            text: 'Time'
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Value'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                }
            }
        });
    }
}

function handleTimeRangeChange() {
    const timeRange = document.getElementById('timeRange');
    const customInputs = document.getElementById('customTimeInputs');
    
    if (timeRange.value === 'custom') {
        customInputs.style.display = 'flex';
    } else {
        customInputs.style.display = 'none';
    }
}

async function executeGraph() {
    const query = document.getElementById('graphQuery').value.trim();
    if (!query) {
        showToast('Warning', 'Please enter a query', 'warning');
        return;
    }
    
    const timeRange = document.getElementById('timeRange').value;
    const { start, end } = getTimeRange(timeRange);
    
    showLoading('Loading graph data...');
    
    try {
        const params = {
            query: query,
            start: Math.floor(start / 1000),
            end: Math.floor(end / 1000),
            step: calculateStep(start, end)
        };
        
        const data = await callPrometheusAPI('query_range', params);
        displayGraphResults(data);
        
    } catch (error) {
        console.error('Graph execution failed:', error);
        showToast('Error', `Graph failed: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

function getTimeRange(rangeValue) {
    const end = Date.now();
    let start;
    
    switch (rangeValue) {
        case '1h':
            start = end - (60 * 60 * 1000);
            break;
        case '6h':
            start = end - (6 * 60 * 60 * 1000);
            break;
        case '12h':
            start = end - (12 * 60 * 60 * 1000);
            break;
        case '1d':
            start = end - (24 * 60 * 60 * 1000);
            break;
        case '3d':
            start = end - (3 * 24 * 60 * 60 * 1000);
            break;
        case '1w':
            start = end - (7 * 24 * 60 * 60 * 1000);
            break;
        case '1M':
            start = end - (30 * 24 * 60 * 60 * 1000);
            break;
        case 'custom':
            const startInput = document.getElementById('startTime');
            const endInput = document.getElementById('endTime');
            start = new Date(startInput.value).getTime();
            end = new Date(endInput.value).getTime();
            break;
        default:
            start = end - (24 * 60 * 60 * 1000);
    }
    
    return { start, end };
}

function calculateStep(start, end) {
    const duration = end - start;
    const points = 200;
    return Math.max(15, Math.floor(duration / (points * 1000)));
}

function displayGraphResults(data) {
    const graphEmpty = document.getElementById('graphEmpty');
    
    if (!data || !data.data || !data.data.result || data.data.result.length === 0) {
        graphEmpty.style.display = 'block';
        if (metricsChart) {
            metricsChart.data.datasets = [];
            metricsChart.update();
        }
        return;
    }
    
    graphEmpty.style.display = 'none';
    
    if (metricsChart) {
        const datasets = data.data.result.map((series, index) => {
            const color = getColorForIndex(index);
            return {
                label: formatMetricName(series.metric),
                data: series.values.map(([timestamp, value]) => ({
                    x: timestamp * 1000,
                    y: parseFloat(value)
                })),
                borderColor: color,
                backgroundColor: color + '20',
                fill: false,
                tension: 0.1
            };
        });
        
        metricsChart.data.datasets = datasets;
        metricsChart.update();
    }
}

function getColorForIndex(index) {
    const colors = [
        '#e6522c', '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
        '#8b5cf6', '#06b6d4', '#84cc16', '#f97316', '#ec4899'
    ];
    return colors[index % colors.length];
}

// Alerts Tab Functions
async function loadAlerts() {
    const alertsList = document.getElementById('alertsList');
    
    try {
        const data = await callPrometheusAPI('alerts');
        displayAlerts(data.data.alerts || []);
        
    } catch (error) {
        console.error('Failed to load alerts:', error);
        alertsList.innerHTML = `
            <div class="empty-results">
                <i class="fas fa-exclamation-triangle" style="color: var(--danger-color);"></i>
                <p>Failed to load alerts: ${error.message}</p>
            </div>
        `;
    }
}

function displayAlerts(alerts) {
    const alertsList = document.getElementById('alertsList');
    
    // Calculate summary stats
    const firing = alerts.filter(a => a.state === 'firing').length;
    const pending = alerts.filter(a => a.state === 'pending').length;
    const inactive = alerts.filter(a => a.state === 'inactive').length;
    
    document.getElementById('firingAlerts').textContent = firing;
    document.getElementById('pendingAlerts').textContent = pending;
    document.getElementById('inactiveAlerts').textContent = inactive;
    
    if (alerts.length === 0) {
        alertsList.innerHTML = `
            <div class="empty-results">
                <i class="fas fa-check-circle" style="color: var(--success-color);"></i>
                <p>No alerts found</p>
            </div>
        `;
        return;
    }
    
    alertsList.innerHTML = alerts.map(alert => `
        <div class="alert-item ${alert.state}">
            <div class="alert-header">
                <div class="alert-name">${escapeHtml(alert.labels.alertname)}</div>
                <span class="status-badge ${alert.state}">
                    <i class="fas ${getAlertIcon(alert.state)}"></i>
                    ${alert.state.toUpperCase()}
                </span>
            </div>
            <div class="alert-summary">${escapeHtml(alert.annotations.summary || '')}</div>
            <div class="alert-labels">
                ${Object.entries(alert.labels).map(([key, value]) => 
                    `<span class="label-badge">${key}="${value}"</span>`
                ).join('')}
            </div>
            <div class="alert-timing">
                <small class="text-muted">
                    Active since: ${formatDateTime(alert.activeAt)}
                </small>
            </div>
        </div>
    `).join('');
}

function getAlertIcon(state) {
    switch (state) {
        case 'firing': return 'fa-fire';
        case 'pending': return 'fa-clock';
        case 'inactive': return 'fa-check';
        default: return 'fa-question';
    }
}

// Targets Tab Functions
async function loadTargets() {
    const targetsList = document.getElementById('targetsList');
    
    try {
        const data = await callPrometheusAPI('targets');
        displayTargets(data.data.activeTargets || []);
        
    } catch (error) {
        console.error('Failed to load targets:', error);
        targetsList.innerHTML = `
            <div class="empty-results">
                <i class="fas fa-exclamation-triangle" style="color: var(--danger-color);"></i>
                <p>Failed to load targets: ${error.message}</p>
            </div>
        `;
    }
}

function displayTargets(targets) {
    const targetsList = document.getElementById('targetsList');
    
    // Calculate summary stats
    const up = targets.filter(t => t.health === 'up').length;
    const down = targets.filter(t => t.health === 'down').length;
    
    document.getElementById('targetsUp').textContent = up;
    document.getElementById('targetsDown').textContent = down;
    document.getElementById('targetsTotal').textContent = targets.length;
    
    if (targets.length === 0) {
        targetsList.innerHTML = `
            <div class="empty-results">
                <i class="fas fa-bullseye"></i>
                <p>No targets configured</p>
            </div>
        `;
        return;async function executeGraph() {
    const query = document.getElementById('graphQuery').value.trim();
    if (!query) {
        showToast('Warning', 'Please enter a query', 'warning');
        return;
    }
    
    const timeRange = document.getElementById('timeRange').value;
    const { start, end } = getTimeRange(timeRange);
    
    showLoading('Loading graph data...');
    
    try {
        const params = {
            query: query,
            start: Math.floor(start / 1000),
            end: Math.floor(end / 1000),
            step: calculateStep(start, end)
        };
        
        const data = await callPrometheusAPI('query_range', params);
        displayGraphResults(data);
        
    } catch (error) {
        console.error('Graph execution failed:', error);
        showToast('Error', `Graph failed: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

    }
    
    targetsList.innerHTML = targets.map(target => `
        <div class="target-item ${target.health}">
            <div class="target-header">
                <div class="target-name">${escapeHtml(target.scrapeUrl)}</div>
                <span class="status-badge ${target.health === 'up' ? 'enabled' : 'disabled'}">
                    <i class="fas ${target.health === 'up' ? 'fa-check' : 'fa-times'}"></i>
                    ${target.health.toUpperCase()}
                </span>
            </div>
            <div class="target-details">
                <div><strong>Job:</strong> ${escapeHtml(target.labels.job)}</div>
                <div><strong>Instance:</strong> ${escapeHtml(target.labels.instance)}</div>
                <div><strong>Last Scrape:</strong> ${formatDateTime(target.lastScrape)}</div>
                <div><strong>Duration:</strong> ${target.lastScrapeDuration}ms</div>
                ${target.lastError ? `<div style="color: var(--danger-color);"><strong>Error:</strong> ${escapeHtml(target.lastError)}</div>` : ''}
            </div>
            <div class="target-labels">
                ${Object.entries(target.labels).map(([key, value]) => 
                    `<span class="label-badge">${key}="${value}"</span>`
                ).join('')}
            </div>
        </div>
    `).join('');
}

// System Status Functions
async function loadSystemStatus() {
    await Promise.all([
        loadBuildInfo(),
        loadRuntimeInfo(),
        loadConfigFlags(),
        loadTSDBStats()
    ]);
}

async function loadBuildInfo() {
    try {
        const data = await callPrometheusAPI('status/buildinfo');
        displayStatusInfo('buildInfo', {
            'Version': data.data.version,
            'Revision': data.data.revision,
            'Branch': data.data.branch,
            'Build Date': data.data.buildDate,
            'Go Version': data.data.goVersion
        });
    } catch (error) {
        displayStatusError('buildInfo', 'Failed to load build info');
    }
}

async function loadRuntimeInfo() {
    try {
        const data = await callPrometheusAPI('status/runtimeinfo');
        displayStatusInfo('runtimeInfo', {
            'Start Time': formatDateTime(data.data.startTime),
            'Reload Config Success': data.data.reloadConfigSuccess ? 'Yes' : 'No',
            'Last Config Time': formatDateTime(data.data.lastConfigTime),
            'Corruption Count': data.data.corruptionCount,
            'Goroutines': data.data.goroutineCount,
            'GOGC': data.data.GOGC,
            'GOMAXPROCS': data.data.GOMAXPROCS
        });
    } catch (error) {
        displayStatusError('runtimeInfo', 'Failed to load runtime info');
    }
}

async function loadConfigFlags() {
    try {
        const data = await callPrometheusAPI('status/flags');
        const flags = Object.entries(data.data).reduce((acc, [key, value]) => {
            acc[key.replace(/^--/, '')] = value;
            return acc;
        }, {});
        
        displayStatusInfo('configFlags', flags);
    } catch (error) {
        displayStatusError('configFlags', 'Failed to load configuration flags');
    }
}


async function loadTSDBStats() {
    try {
        const data = await callPrometheusAPI('status/tsdb');
        displayStatusInfo('tsdbStats', {
            'Head Stats': `${data.data.headStats.numSeries} series, ${data.data.headStats.numSamples} samples`,
            'Symbol Table Size': formatBytes(data.data.symbolTableSizeBytes),
            'Chunks Created': data.data.headStats.chunkCount,
            'WAL Size': formatBytes(data.data.headStats.walFileSize),
            'Blocks': data.data.seriesCountByMetricName ? Object.keys(data.data.seriesCountByMetricName).length : 0
        });
    } catch (error) {
        displayStatusError('tsdbStats', 'Failed to load TSDB stats');
    }
}

function displayStatusInfo(elementId, info) {
    const element = document.getElementById(elementId);
    element.innerHTML = `
        <div class="status-info">
            ${Object.entries(info).map(([key, value]) => `
                <div class="status-item">
                    <div class="status-item-label">${key}</div>
                    <div class="status-item-value">${escapeHtml(String(value))}</div>
                </div>
            `).join('')}
        </div>
    `;
}

function displayStatusError(elementId, message) {
    const element = document.getElementById(elementId);
    element.innerHTML = `
        <div class="empty-results">
            <i class="fas fa-exclamation-triangle" style="color: var(--danger-color);"></i>
            <p>${message}</p>
        </div>
    `;
}

// Retention Management Functions
async function loadPolicies() {
    showLoading();
    
    try {
        const response = await fetch(`${API_BASE}/retention-policies`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        policies = await response.json();
        renderPoliciesTable();
    } catch (error) {
        console.error('Failed to load policies:', error);
        showToast('Error', 'Failed to load retention policies', 'error');
        showEmptyState();
    } finally {
        hideLoading();
    }
}

function renderPoliciesTable() {
    const tbody = document.getElementById('policiesTableBody');
    const emptyState = document.getElementById('emptyState');
    const table = document.getElementById('policiesTable');
    
    if (policies.length === 0) {
        showEmptyState();
        return;
    }
    
    table.style.display = 'table';
    emptyState.style.display = 'none';
    
    tbody.innerHTML = policies.map(policy => `
        <tr>
            <td><span class="text-bold">#${policy.id}</span></td>
            <td>
                <code class="metric-pattern">${escapeHtml(policy.metric_name_pattern)}</code>
            </td>
            <td>
                <span class="text-bold">${formatRetentionPeriod(policy.retention_days)}</span>
            </td>
            <td>
                <span class="text-muted">${escapeHtml(policy.description || 'No description')}</span>
            </td>
            <td>
                <span class="status-badge ${policy.enabled ? 'enabled' : 'disabled'}">
                    <i class="fas ${policy.enabled ? 'fa-check' : 'fa-times'}"></i>
                    ${policy.enabled ? 'Enabled' : 'Disabled'}
                </span>
            </td>
            <td>
                <span class="text-small text-muted">
                    ${policy.last_executed ? formatDateTime(policy.last_executed) : 'Never'}
                </span>
            </td>
            <td>
                <div class="actions">
                    <button class="btn btn-info btn-sm" onclick="executePolicy(${policy.id})" 
                            title="Execute Policy" ${!policy.enabled ? 'disabled' : ''}>
                        <i class="fas fa-play"></i>
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="editPolicy(${policy.id})" title="Edit Policy">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deletePolicy(${policy.id})" title="Delete Policy">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function showEmptyState() {
    document.getElementById('policiesTable').style.display = 'none';
    document.getElementById('emptyState').style.display = 'block';
}

// Modal Functions
function showCreateModal() {
    currentEditingId = null;
    document.getElementById('modalTitle').innerHTML = '<i class="fas fa-plus"></i> Create New Policy';
    document.getElementById('submitBtn').innerHTML = '<i class="fas fa-save"></i> Create Policy';
    document.getElementById('policyForm').reset();
    document.getElementById('enabled').checked = true;
    showModal('policyModal');
}

function editPolicy(id) {
    const policy = policies.find(p => p.id === id);
    if (!policy) return;
    
    currentEditingId = id;
    document.getElementById('modalTitle').innerHTML = '<i class="fas fa-edit"></i> Edit Policy';
    document.getElementById('submitBtn').innerHTML = '<i class="fas fa-save"></i> Update Policy';
    
    document.getElementById('metricPattern').value = policy.metric_name_pattern;
    document.getElementById('retentionDays').value = policy.retention_days;
    document.getElementById('description').value = policy.description || '';
    document.getElementById('enabled').checked = policy.enabled;
    
    showModal('policyModal');
}

function showModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('show'), 10);
}

function closePolicyModal() {
    const modal = document.getElementById('policyModal');
    modal.classList.remove('show');
    setTimeout(() => modal.style.display = 'none', 300);
}

function closeConfirmModal() {
    const modal = document.getElementById('confirmModal');
    modal.classList.remove('show');
    setTimeout(() => modal.style.display = 'none', 300);
}

// Policy Management Functions
async function submitPolicy(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const data = {
        metric_name_pattern: formData.get('metricPattern').trim(),
        retention_days: parseFloat(formData.get('retentionDays')),
        description: formData.get('description').trim() || null,
        enabled: formData.has('enabled')
    };
    
    try {
        const url = currentEditingId 
            ? `${API_BASE}/retention-policies/${currentEditingId}` 
            : `${API_BASE}/retention-policies`;
        
        const method = currentEditingId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `HTTP ${response.status}`);
        }
        
        const action = currentEditingId ? 'updated' : 'created';
        showToast('Success', `Policy ${action} successfully`, 'success');
        
        closePolicyModal();
        await loadPolicies();
        
    } catch (error) {
        console.error('Failed to save policy:', error);
        showToast('Error', error.message, 'error');
    }
}

async function deletePolicy(id) {
    const policy = policies.find(p => p.id === id);
    if (!policy) return;
    
    showConfirmModal(
        'Delete Policy',
        `Are you sure you want to delete the policy for "${policy.metric_name_pattern}"? This action cannot be undone.`,
        async () => {
            try {
                const response = await fetch(`${API_BASE}/retention-policies/${id}`, {
                    method: 'DELETE'
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                
                showToast('Success', 'Policy deleted successfully', 'success');
                await loadPolicies();
                
            } catch (error) {
                console.error('Failed to delete policy:', error);
                showToast('Error', 'Failed to delete policy', 'error');
            }
        }
    );
}

async function executePolicy(id) {
    const policy = policies.find(p => p.id === id);
    if (!policy) return;
    
    if (!policy.enabled) {
        showToast('Warning', 'Cannot execute disabled policy', 'warning');
        return;
    }
    
    try {
        showToast('Info', 'Executing policy...', 'info');
        
        const response = await fetch(`${API_BASE}/retention-policies/${id}/execute`, {
            method: 'POST'
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `HTTP ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            showToast('Success', `Policy executed: ${result.series_deleted} series deleted from ${result.metrics_found} metrics`, 'success');
            await loadPolicies();
        } else {
            showToast('Error', `Policy execution failed: ${result.error_message}`, 'error');
        }
        
    } catch (error) {
        console.error('Failed to execute policy:', error);
        showToast('Error', error.message, 'error');
    }
}

async function executeAllPolicies() {
    showConfirmModal(
        'Execute All Policies',
        'This will execute all enabled retention policies. This may take some time and will delete old metric data. Continue?',
        async () => {
            try {
                showToast('Info', 'Executing all policies...', 'info');
                
                const response = await fetch(`${API_BASE}/execute-all-policies`, {
                    method: 'POST'
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || `HTTP ${response.status}`);
                }
                
                const data = await response.json();
                const results = data.results || [];
                
                const successful = results.filter(r => r.success).length;
                const failed = results.length - successful;
                const totalDeleted = results.reduce((sum, r) => sum + (r.series_deleted || 0), 0);
                
                showToast('Success', `All policies executed: ${successful} successful, ${failed} failed, ${totalDeleted} total series deleted`, 'success');
                
                await loadPolicies();
                
            } catch (error) {
                console.error('Failed to execute all policies:', error);
                showToast('Error', error.message, 'error');
            }
        }
    );
}

async function refreshPolicies() {
    await loadPolicies();
    showToast('Info', 'Policies refreshed', 'info');
}

// Form Validation
function setupFormValidation() {
    const form = document.getElementById('policyForm');
    if (!form) return;
    
    const metricPattern = document.getElementById('metricPattern');
    const retentionDays = document.getElementById('retentionDays');
    
    if (metricPattern) {
        metricPattern.addEventListener('input', function() {
            validateMetricPattern(this.value);
        });
    }
    
    if (retentionDays) {
        retentionDays.addEventListener('input', function() {
            validateRetentionDays(this.value);
        });
    }
}

function validateMetricPattern(pattern) {
    const input = document.getElementById('metricPattern');
    
    if (!pattern.trim()) {
        setFieldError(input, 'Metric pattern is required');
        return false;
    }
    
    try {
        if (pattern.includes('*') || pattern.includes('?')) {
            const regexPattern = pattern.replace(/\*/g, '.*').replace(/\?/g, '.');
            new RegExp(regexPattern);
        } else {
            new RegExp(pattern);
        }
        
        setFieldValid(input);
        return true;
    } catch (e) {
        setFieldError(input, 'Invalid pattern syntax');
        return false;
    }
}

function validateRetentionDays(days) {
    const input = document.getElementById('retentionDays');
    const value = parseFloat(days);
    
    if (isNaN(value) || value < 0.0007) {
        setFieldError(input, 'Minimum retention is 1 minute (0.0007 days)');
        return false;
    }
    
    if (value > 3650) {
        setFieldError(input, 'Maximum retention is 10 years (3650 days)');
        return false;
    }
    
    setFieldValid(input);
    return true;
}

function setFieldError(input, message) {
    input.style.borderColor = 'var(--danger-color)';
    
    const existingError = input.parentNode.querySelector('.field-error');
    if (existingError) existingError.remove();
    
    const errorDiv = document.createElement('small');
    errorDiv.className = 'field-error';
    errorDiv.style.color = 'var(--danger-color)';
    errorDiv.style.marginTop = '0.25rem';
    errorDiv.textContent = message;
    input.parentNode.appendChild(errorDiv);
}

function setFieldValid(input) {
    input.style.borderColor = 'var(--border)';
    
    const existingError = input.parentNode.querySelector('.field-error');
    if (existingError) existingError.remove();
}

function updateRetentionValue() {
    const daysInput = document.getElementById('retentionDays');
    const value = parseFloat(daysInput.value) || 0;
    validateRetentionDays(value);
}

// Confirmation Modal
function showConfirmModal(title, message, callback) {
    document.getElementById('confirmTitle').innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${title}`;
    document.getElementById('confirmMessage').textContent = message;
    confirmCallback = callback;
    showModal('confirmModal');
}

function confirmAction() {
    if (confirmCallback) {
        confirmCallback();
        confirmCallback = null;
    }
    closeConfirmModal();
}

// Loading and Toast Functions
function showLoading(message = 'Loading...') {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.querySelector('p').textContent = message;
        overlay.style.display = 'flex';
    }
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

function showToast(title, message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    toast.innerHTML = `
        <i class="fas ${icons[type]}"></i>
        <div class="toast-content">
            <div class="toast-title">${escapeHtml(title)}</div>
            <div class="toast-message">${escapeHtml(message)}</div>
        </div>
        <button class="toast-close" onclick="removeToast(this.parentElement)">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => removeToast(toast), 5000);
}

function removeToast(toast) {
    if (toast && toast.parentElement) {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentElement) {
                toast.parentElement.removeChild(toast);
            }
        }, 300);
    }
}

// Keyboard Shortcuts
function handleKeyboardShortcuts(event) {
    if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
            case '1':
                event.preventDefault();
                switchTab('query');
                break;
            case '2':
                event.preventDefault();
                switchTab('graph');
                break;
            case '3':
                event.preventDefault();
                switchTab('alerts');
                break;
            case '4':
                event.preventDefault();
                switchTab('targets');
                break;
            case '5':
                event.preventDefault();
                switchTab('retention');
                break;
            case '6':
                event.preventDefault();
                switchTab('config');
                break;
        }
    }
    
    // Close modals with Escape
    if (event.key === 'Escape') {
        closePolicyModal();
        closeConfirmModal();
    }
}

// Utility Functions
function formatMetricName(metric) {
    if (!metric || !metric.__name__) {
        return 'unknown';
    }
    
    const labels = Object.entries(metric)
        .filter(([key]) => key !== '__name__')
        .map(([key, value]) => `${key}="${value}"`)
        .join(', ');
    
    return labels ? `${metric.__name__}{${labels}}` : metric.__name__;
}

function formatRetentionPeriod(days) {
    if (days < 1) {
        const hours = days * 24;
        if (hours < 1) {
            const minutes = hours * 60;
            return `${Math.round(minutes)}m`;
        }
        return `${Math.round(hours)}h`;
    } else if (days < 7) {
        return `${Math.round(days * 10) / 10}d`;
    } else if (days < 30) {
        const weeks = days / 7;
        return `${Math.round(weeks * 10) / 10}w`;
    } else {
        const months = days / 30;
        return `${Math.round(months * 10) / 10}mo`;
    }
}

function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) {
        return 'Just now';
    }
    
    if (diff < 3600000) {
        const minutes = Math.floor(diff / 60000);
        return `${minutes}m ago`;
    }
    
    if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return `${hours}h ago`;
    }
    
    if (diff < 604800000) {
        const days = Math.floor(diff / 86400000);
        return `${days}d ago`;
    }
    
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatTimestamp(timestamp) {
    return new Date(timestamp * 1000).toLocaleString();
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}