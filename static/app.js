// Global variables
let policies = [];
let currentEditingId = null;
let confirmCallback = null;

// API base URL - adjust this if your API runs on a different port/host
const API_BASE = window.location.origin;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    checkApiHealth();
    loadPolicies();
    setupFormValidation();
    
    // Check API health every 30 seconds
    setInterval(checkApiHealth, 30000);
});

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

// Load and display policies
async function loadPolicies() {
    showLoading(true);
    
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
        showLoading(false);
    }
}

// Render policies table
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

// Show empty state
function showEmptyState() {
    document.getElementById('policiesTable').style.display = 'none';
    document.getElementById('emptyState').style.display = 'block';
}

// Show/hide loading spinner
function showLoading(show) {
    const spinner = document.getElementById('loadingSpinner');
    const table = document.getElementById('policiesTable');
    const emptyState = document.getElementById('emptyState');
    
    if (show) {
        spinner.style.display = 'flex';
        table.style.display = 'none';
        emptyState.style.display = 'none';
    } else {
        spinner.style.display = 'none';
    }
}

// Modal functions
function showCreateModal() {
    currentEditingId = null;
    document.getElementById('modalTitle').innerHTML = '<i class="fas fa-plus"></i> Create New Policy';
    document.getElementById('submitBtn').innerHTML = '<i class="fas fa-save"></i> Create Policy';
    document.getElementById('policyForm').reset();
    document.getElementById('enabled').checked = true;
    showModal('policyModal');
    enforceWhiteInputs();
}

function editPolicy(id) {
    const policy = policies.find(p => p.id === id);
    if (!policy) return;
    
    currentEditingId = id;
    document.getElementById('modalTitle').innerHTML = '<i class="fas fa-edit"></i> Edit Policy';
    document.getElementById('submitBtn').innerHTML = '<i class="fas fa-save"></i> Update Policy';
    
    // Populate form
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

// Close modals when clicking outside
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal')) {
        if (e.target.id === 'policyModal') closePolicyModal();
        if (e.target.id === 'confirmModal') closeConfirmModal();
    }
});

// Form validation and submission
function setupFormValidation() {
    const form = document.getElementById('policyForm');
    const metricPattern = document.getElementById('metricPattern');
    const retentionDays = document.getElementById('retentionDays');
    
    // Real-time validation
    metricPattern.addEventListener('input', function() {
        validateMetricPattern(this.value);
    });
    
    retentionDays.addEventListener('input', function() {
        validateRetentionDays(this.value);
    });
}

function validateMetricPattern(pattern) {
    const input = document.getElementById('metricPattern');
    
    if (!pattern.trim()) {
        setFieldError(input, 'Metric pattern is required');
        return false;
    }
    
    try {
        // Test if it's a valid regex pattern
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
    
    // Remove existing error message
    const existingError = input.parentNode.querySelector('.field-error');
    if (existingError) existingError.remove();
    
    // Add error message
    const errorDiv = document.createElement('small');
    errorDiv.className = 'field-error';
    errorDiv.style.color = 'var(--danger-color)';
    errorDiv.style.marginTop = '0.25rem';
    errorDiv.textContent = message;
    input.parentNode.appendChild(errorDiv);
}

function setFieldValid(input) {
    input.style.borderColor = 'var(--border)';
    
    // Remove error message
    const existingError = input.parentNode.querySelector('.field-error');
    if (existingError) existingError.remove();
}

async function submitPolicy(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const data = {
        metric_name_pattern: formData.get('metricPattern').trim(),
        retention_days: parseFloat(formData.get('retentionDays')),
        description: formData.get('description').trim() || null,
        enabled: formData.has('enabled')
    };
    
    // Validate before submission
    if (!validateMetricPattern(data.metric_name_pattern) || 
        !validateRetentionDays(data.retention_days)) {
        return;
    }
    
    try {
        const url = currentEditingId 
            ? `${API_BASE}/retention-policies/${currentEditingId}` 
            : `${API_BASE}/retention-policies`;
        
        const method = currentEditingId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
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

// Policy actions
function deletePolicy(id) {
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
            showToast(
                'Success', 
                `Policy executed: ${result.series_deleted} series deleted from ${result.metrics_found} metrics`,
                'success'
            );
            await loadPolicies(); // Refresh to show updated last_executed time
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
                
                showToast(
                    'Success',
                    `All policies executed: ${successful} successful, ${failed} failed, ${totalDeleted} total series deleted`,
                    'success'
                );
                
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

// Confirmation modal
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

// Toast notifications
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
    
    // Show toast
    setTimeout(() => toast.classList.add('show'), 100);
    
    // Auto remove after 5 seconds
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

// Retention unit converter
function updateRetentionValue() {
    const daysInput = document.getElementById('retentionDays');
    const unitSelect = document.getElementById('retentionUnit');
    const currentValue = parseFloat(daysInput.value) || 0;
    const currentUnit = unitSelect.value;
    
    // This function is called when unit changes, but we don't auto-convert
    // to avoid confusing the user. Just update validation.
    validateRetentionDays(currentValue);
}

// Utility functions
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
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    // If less than 1 minute ago
    if (diff < 60000) {
        return 'Just now';
    }
    
    // If less than 1 hour ago
    if (diff < 3600000) {
        const minutes = Math.floor(diff / 60000);
        return `${minutes}m ago`;
    }
    
    // If less than 1 day ago
    if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return `${hours}h ago`;
    }
    
    // If less than 1 week ago
    if (diff < 604800000) {
        const days = Math.floor(diff / 86400000);
        return `${days}d ago`;
    }
    
    // Otherwise show full date
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}