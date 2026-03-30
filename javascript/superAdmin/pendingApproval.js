// Pending Approvals JavaScript
// Add this to your existing JavaScript file

// Global variables
let approvalsData = null;
let currentFilter = 'all';
let searchTerm = '';

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    loadApprovals();
    
    // Set up auto-refresh every 30 seconds for time-sensitive data
    setInterval(updateTimeLeft, 1000); // Update countdown every second
    setInterval(loadApprovals, 30000); // Refresh data every 30 seconds
});

// Load approvals from API
async function loadApprovals() {
    try {
        // Show loading state
        showApprovalsLoading();
        
        // Fetch approvals data from API
        const response = await fetch('/api/approvals');
        if (!response.ok) throw new Error('Failed to fetch approvals');
        
        approvalsData = await response.json();
        
        // Update UI
        updateApprovalStats(approvalsData.stats);
        renderApprovalsList(approvalsData.pending);
        renderApprovalHistory(approvalsData.history);
        
    } catch (error) {
        console.error('Error loading approvals:', error);
        showApprovalsError();
    }
}

// Show loading state
function showApprovalsLoading() {
    document.getElementById('pending-count').textContent = '...';
    document.getElementById('approved-today').textContent = '...';
    document.getElementById('expiring-soon').textContent = '...';
    
    const tbody = document.getElementById('approvals-body');
    tbody.innerHTML = `
        <tr>
            <td colspan="6" style="text-align:center; padding:40px;">
                <div style="display:flex; flex-direction:column; align-items:center; gap:12px;">
                    <div class="loading-spinner"></div>
                    <span style="color:var(--muted);">Loading approval requests...</span>
                </div>
            </td>
        </tr>
    `;
}

// Show error state
function showApprovalsError() {
    document.getElementById('pending-count').textContent = 'Error';
    document.getElementById('approved-today').textContent = 'Error';
    document.getElementById('expiring-soon').textContent = 'Error';
    
    const tbody = document.getElementById('approvals-body');
    tbody.innerHTML = `
        <tr>
            <td colspan="6" style="text-align:center; padding:40px; color:var(--error);">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="1"/></svg>
                <p style="margin-top:12px;">Failed to load approvals. <button onclick="loadApprovals()" style="color:var(--sa-accent);">Retry</button></p>
            </td>
        </tr>
    `;
}

// Update approval statistics
function updateApprovalStats(stats) {
    document.getElementById('pending-count').textContent = stats.pending || 0;
    document.getElementById('approved-today').textContent = stats.approvedToday || 0;
    document.getElementById('expiring-soon').textContent = stats.expiringSoon || 0;
}

// Render approvals list with filters
function renderApprovalsList(pendingApprovals) {
    const tbody = document.getElementById('approvals-body');
    const emptyState = document.getElementById('approvals-empty');
    
    // Filter approvals based on type filter and search
    const filteredApprovals = pendingApprovals.filter(approval => {
        const matchesFilter = currentFilter === 'all' || approval.type === currentFilter;
        const matchesSearch = searchTerm === '' || 
            approval.requestedBy.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            approval.target.toLowerCase().includes(searchTerm.toLowerCase()) ||
            approval.reason.toLowerCase().includes(searchTerm.toLowerCase());
        
        return matchesFilter && matchesSearch;
    });
    
    // Show/hide empty state
    if (filteredApprovals.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    
    emptyState.style.display = 'none';
    
    // Render filtered approvals
    tbody.innerHTML = filteredApprovals.map(approval => {
        const urgencyClass = getUrgencyClass(approval.timeLeft);
        const badgeStyle = getBadgeStyle(approval.type);
        const timeDisplay = getTimeDisplay(approval.timeLeft);
        
        return `
            <tr class="approval-row ${urgencyClass}" data-id="${approval.id}">
                <td>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <span class="badge" style="${badgeStyle}">${formatApprovalType(approval.type)}</span>
                    </div>
                </td>
                <td>
                    <div style="display:flex;align-items:center;gap:6px;">
                        <div class="sidebar-user-avatar" style="width:24px;height:24px;font-size:10px;background:${approval.requestedBy.avatarColor || 'var(--sa-grad)'};">
                            ${approval.requestedBy.initials}
                        </div>
                        <span>${approval.requestedBy.name}</span>
                    </div>
                </td>
                <td>
                    <strong>${approval.target}</strong>
                    ${approval.targetDetails ? `<br><small style="color:var(--muted);">${approval.targetDetails}</small>` : ''}
                </td>
                <td>
                    <span class="approval-reason" title="${approval.reason}">${truncateText(approval.reason, 40)}</span>
                </td>
                <td>
                    <span class="${getTimeClass(approval.timeLeft)}" data-time-left="${approval.timeLeft}">
                        ${timeDisplay}
                    </span>
                </td>
                <td>
                    <div class="quick-actions">
                        <button class="quick-action-btn" onclick="viewApprovalDetails('${approval.id}')" style="color:var(--sa-accent);">Review</button>
                        <button class="quick-action-btn" onclick="approveQuick('${approval.id}')" style="background:#dcfce7;color:#166534;">✓</button>
                        <button class="quick-action-btn" onclick="rejectQuick('${approval.id}')" style="background:#fee2e2;color:#b91c1c;">✗</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Render approval history
function renderApprovalHistory(history) {
    const tbody = document.getElementById('approval-history-body');
    
    if (!history || history.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align:center; padding:32px; color:var(--muted);">
                    No recent activity
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = history.map(item => {
        const statusStyle = item.status === 'approved' 
            ? 'background:#dcfce7;color:#166534;'
            : item.status === 'rejected'
            ? 'background:#fee2e2;color:#b91c1c;'
            : 'background:#fef3c7;color:#b45309;';
        
        return `
            <tr>
                <td>${formatApprovalType(item.type)} (${item.target})</td>
                <td>${item.requestedBy}</td>
                <td>${item.approvedBy || '-'}</td>
                <td><span class="badge" style="${statusStyle}">${capitalizeFirst(item.status)}</span></td>
                <td>${formatTimeAgo(item.timestamp)}</td>
            </tr>
        `;
    }).join('');
}

// Filter approvals by type
function filterApprovals() {
    currentFilter = document.getElementById('approval-type-filter').value;
    searchTerm = document.getElementById('approval-search').value;
    
    if (approvalsData) {
        renderApprovalsList(approvalsData.pending);
    }
}

// Search approvals
document.getElementById('approval-search').addEventListener('keyup', filterApprovals);

// Update time left countdowns every second
function updateTimeLeft() {
    const timeElements = document.querySelectorAll('[data-time-left]');
    timeElements.forEach(element => {
        const timeLeft = parseInt(element.dataset.timeLeft);
        if (timeLeft > 0) {
            const newTimeLeft = timeLeft - 1;
            element.dataset.timeLeft = newTimeLeft;
            element.textContent = getTimeDisplay(newTimeLeft);
            
            // Update urgency class on parent row
            const row = element.closest('tr');
            if (row) {
                row.className = `approval-row ${getUrgencyClass(newTimeLeft)}`;
            }
        }
    });
}

// Quick approve request
async function approveQuick(requestId) {
    if (!confirm('Are you sure you want to approve this request?')) return;
    
    try {
        const button = event.target;
        button.disabled = true;
        button.innerHTML = '...';
        
        const response = await fetch(`/api/approvals/${requestId}/approve`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) throw new Error('Failed to approve');
        
        // Show success message
        showToast('Request approved successfully', 'success');
        
        // Reload approvals
        loadApprovals();
        
    } catch (error) {
        console.error('Error approving request:', error);
        showToast('Failed to approve request', 'error');
        
        const button = event.target;
        button.disabled = false;
        button.innerHTML = '✓';
    }
}

// Quick reject request
async function rejectQuick(requestId) {
    const reason = prompt('Please provide a reason for rejection:');
    if (reason === null) return; // User cancelled
    
    try {
        const button = event.target;
        button.disabled = true;
        button.innerHTML = '...';
        
        const response = await fetch(`/api/approvals/${requestId}/reject`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason })
        });
        
        if (!response.ok) throw new Error('Failed to reject');
        
        // Show success message
        showToast('Request rejected', 'success');
        
        // Reload approvals
        loadApprovals();
        
    } catch (error) {
        console.error('Error rejecting request:', error);
        showToast('Failed to reject request', 'error');
        
        const button = event.target;
        button.disabled = false;
        button.innerHTML = '✗';
    }
}

// View approval details
async function viewApprovalDetails(requestId) {
    try {
        // Fetch detailed request information
        const response = await fetch(`/api/approvals/${requestId}`);
        if (!response.ok) throw new Error('Failed to fetch details');
        
        const details = await response.json();
        
        // Show modal with details
        showApprovalDetailsModal(details);
        
    } catch (error) {
        console.error('Error fetching approval details:', error);
        showToast('Failed to load request details', 'error');
    }
}

// Show approval details modal
function showApprovalDetailsModal(details) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('approval-details-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'approval-details-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:500px;">
                <div class="modal-header">
                    <h3>Request Details</h3>
                    <button class="modal-close" onclick="closeModal()">&times;</button>
                </div>
                <div class="modal-body" id="approval-details-body">
                    <!-- Content will be inserted here -->
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal()">Close</button>
                    <button class="btn btn-success" onclick="approveFromModal()" id="modal-approve-btn">Approve</button>
                    <button class="btn btn-danger" onclick="rejectFromModal()" id="modal-reject-btn">Reject</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Add modal styles
        const style = document.createElement('style');
        style.textContent = `
            .modal {
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                z-index: 1000;
                align-items: center;
                justify-content: center;
            }
            .modal.active {
                display: flex;
            }
            .modal-content {
                background: white;
                border-radius: 12px;
                width: 90%;
                max-width: 500px;
                max-height: 80vh;
                overflow-y: auto;
            }
            .modal-header {
                padding: 16px 20px;
                border-bottom: 1px solid var(--border);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .modal-close {
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: var(--muted);
            }
            .modal-body {
                padding: 20px;
            }
            .modal-footer {
                padding: 16px 20px;
                border-top: 1px solid var(--border);
                display: flex;
                gap: 8px;
                justify-content: flex-end;
            }
            .detail-row {
                margin-bottom: 16px;
            }
            .detail-label {
                font-size: 12px;
                color: var(--muted);
                margin-bottom: 4px;
            }
            .detail-value {
                font-weight: 500;
            }
            .detail-value.warning {
                color: #b45309;
            }
            .detail-value.danger {
                color: #b91c1c;
            }
        `;
        document.head.appendChild(style);
    }
    
    // Populate modal with details
    const body = document.getElementById('approval-details-body');
    body.innerHTML = `
        <div class="detail-row">
            <div class="detail-label">Request Type</div>
            <div class="detail-value">
                <span class="badge" style="${getBadgeStyle(details.type)}">${formatApprovalType(details.type)}</span>
            </div>
        </div>
        
        <div class="detail-row">
            <div class="detail-label">Requested By</div>
            <div class="detail-value">
                <div style="display:flex;align-items:center;gap:8px;">
                    <div class="sidebar-user-avatar" style="width:28px;height:28px;background:${details.requestedBy.avatarColor || 'var(--sa-grad)'};">${details.requestedBy.initials}</div>
                    <div>
                        <strong>${details.requestedBy.name}</strong>
                        <div style="font-size:12px;color:var(--muted);">${details.requestedBy.email}</div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="detail-row">
            <div class="detail-label">Target</div>
            <div class="detail-value">
                <strong>${details.target}</strong>
                ${details.targetDetails ? `<br><span style="font-size:13px;color:var(--muted);">${details.targetDetails}</span>` : ''}
            </div>
        </div>
        
        <div class="detail-row">
            <div class="detail-label">Reason</div>
            <div class="detail-value">${details.reason}</div>
        </div>
        
        <div class="detail-row">
            <div class="detail-label">Additional Details</div>
            <div class="detail-value">
                ${details.additionalDetails ? details.additionalDetails : 'No additional details provided'}
            </div>
        </div>
        
        <div class="detail-row">
            <div class="detail-label">Time Left</div>
            <div class="detail-value ${getTimeClass(details.timeLeft)}">${getTimeDisplay(details.timeLeft)}</div>
        </div>
        
        ${details.riskFactors ? `
        <div class="detail-row">
            <div class="detail-label">Risk Assessment</div>
            <div class="detail-value warning">${details.riskFactors}</div>
        </div>
        ` : ''}
    `;
    
    // Store current request ID in modal
    modal.dataset.requestId = details.id;
    
    // Show modal
    modal.classList.add('active');
}

// Close modal
function closeModal() {
    const modal = document.getElementById('approval-details-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Approve from modal
async function approveFromModal() {
    const modal = document.getElementById('approval-details-modal');
    const requestId = modal.dataset.requestId;
    
    closeModal();
    await approveQuick(requestId);
}

// Reject from modal
async function rejectFromModal() {
    const modal = document.getElementById('approval-details-modal');
    const requestId = modal.dataset.requestId;
    
    closeModal();
    await rejectQuick(requestId);
}

// Load approval history
async function loadApprovalHistory() {
    try {
        const response = await fetch('/api/approvals/history');
        if (!response.ok) throw new Error('Failed to fetch history');
        
        const history = await response.json();
        renderApprovalHistory(history);
        
    } catch (error) {
        console.error('Error loading history:', error);
    }
}

// Helper Functions

function getUrgencyClass(timeLeft) {
    if (timeLeft <= 2) return 'urgency-high';
    if (timeLeft <= 12) return 'urgency-medium';
    return 'urgency-low';
}

function getTimeClass(timeLeft) {
    if (timeLeft <= 2) return 'time-urgent';
    if (timeLeft <= 12) return 'time-warning';
    return 'time-normal';
}

function getTimeDisplay(hours) {
    if (hours <= 0) return 'Expired';
    if (hours < 1) {
        const minutes = Math.round(hours * 60);
        return `${minutes} min left`;
    }
    if (hours < 24) {
        return `${hours}h left`;
    }
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h left`;
}

function getBadgeStyle(type) {
    const styles = {
        delete_company: 'background:#fee2e2;color:#b91c1c;border:none;',
        remove_property: 'background:#fee2e2;color:#b91c1c;border:none;',
        suspend_manager: 'background:#fef3c7;color:#b45309;border:none;',
        export_data: 'background:#e0f2fe;color:#0369a1;border:none;',
        lockdown_company: 'background:#fee2e2;color:#b91c1c;border:none;'
    };
    return styles[type] || 'background:#e2e8f0;color:#475569;border:none;';
}

function formatApprovalType(type) {
    const types = {
        delete_company: 'Delete Company',
        remove_property: 'Remove Property',
        suspend_manager: 'Suspend Manager',
        export_data: 'Export Data',
        lockdown_company: 'Lockdown Company'
    };
    return types[type] || type;
}

function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

function formatTimeAgo(timestamp) {
    const seconds = Math.floor((new Date() - new Date(timestamp)) / 1000);
    
    const intervals = {
        year: 31536000,
        month: 2592000,
        week: 604800,
        day: 86400,
        hour: 3600,
        minute: 60
    };
    
    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
        const interval = Math.floor(seconds / secondsInUnit);
        if (interval >= 1) {
            return interval === 1 ? `1 ${unit} ago` : `${interval} ${unit}s ago`;
        }
    }
    
    return 'just now';
}

function capitalizeFirst(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function showToast(message, type = 'info') {
    // Create toast container if it doesn't exist
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1001;
        `;
        document.body.appendChild(container);
    }
    
    // Create toast
    const toast = document.createElement('div');
    toast.style.cssText = `
        background: ${type === 'success' ? '#dcfce7' : type === 'error' ? '#fee2e2' : '#e0f2fe'};
        color: ${type === 'success' ? '#166534' : type === 'error' ? '#b91c1c' : '#0369a1'};
        padding: 12px 20px;
        border-radius: 8px;
        margin-bottom: 10px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        animation: slideIn 0.3s ease;
    `;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            container.removeChild(toast);
        }, 300);
    }, 3000);
}

// Add animation styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .loading-spinner {
        width: 30px;
        height: 30px;
        border: 3px solid var(--border);
        border-top-color: var(--sa-accent);
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);

// Mock data for development
function getMockApprovalsData() {
    return {
        stats: {
            pending: 3,
            approvedToday: 2,
            expiringSoon: 1
        },
        pending: [
            {
                id: 'del_001',
                type: 'delete_company',
                requestedBy: {
                    name: 'Super Admin 2',
                    initials: 'S',
                    email: 'super2@example.com',
                    avatarColor: '#7c3aed'
                },
                target: 'UrbanNest Braamfontein',
                targetDetails: 'Company ID: UN-001',
                reason: 'Company requested deletion - closed business',
                timeLeft: 2,
                riskFactors: 'High impact - affects 50 tenants'
            },
            {
                id: 'sus_001',
                type: 'suspend_manager',
                requestedBy: {
                    name: 'Super Admin 1',
                    initials: 'A',
                    email: 'super1@example.com',
                    avatarColor: '#059669'
                },
                target: 'thabo@sunset.co.za',
                targetDetails: 'Sunset Properties Manager',
                reason: 'Multiple complaints from tenants',
                timeLeft: 12,
                additionalDetails: '3 complaints received this week'
            },
            {
                id: 'exp_001',
                type: 'export_data',
                requestedBy: {
                    name: 'Super Admin 3',
                    initials: 'M',
                    email: 'super3@example.com',
                    avatarColor: '#b45309'
                },
                target: 'All Companies',
                targetDetails: 'Full tenant export',
                reason: 'Annual compliance audit',
                timeLeft: 23
            }
        ],
        history: [
            {
                type: 'delete_company',
                target: 'Apex Properties',
                requestedBy: 'Super Admin 1',
                approvedBy: 'Super Admin 2',
                status: 'approved',
                timestamp: new Date(Date.now() - 2*60*60*1000).toISOString()
            },
            {
                type: 'suspend_manager',
                target: 'alice@apex.co.za',
                requestedBy: 'Super Admin 3',
                approvedBy: 'Super Admin 1',
                status: 'rejected',
                timestamp: new Date(Date.now() - 5*60*60*1000).toISOString()
            }
        ]
    };
}

// Use mock data in development
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    const originalFetch = window.fetch;
    window.fetch = async function(url, options) {
        if (url.includes('/api/approvals') && !url.includes('/history')) {
            return {
                ok: true,
                json: async () => getMockApprovalsData()
            };
        }
        if (url.includes('/api/approvals/history')) {
            return {
                ok: true,
                json: async () => getMockApprovalsData().history
            };
        }
        if (url.includes('/api/approvals/') && !url.includes('/history')) {
            const id = url.split('/').pop();
            const approval = getMockApprovalsData().pending.find(a => a.id === id);
            return {
                ok: true,
                json: async () => approval || { error: 'Not found' }
            };
        }
        return originalFetch(url, options);
    };
}