import { S } from './state.js';
import { apiCall, toast, fmtMoneyAPI, escapeHtml } from './utils.js';

export async function loadUserManualPayments() {
    try {
        const res = await apiCall('/payments/manual/user/all');
        const payments = res.data || [];
        const container = document.getElementById('manualPaymentsList');
        if (!container) return;
        if (!payments.length) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-credit-card"></i><p>No manual payments submitted.</p></div>';
            return;
        }
        container.innerHTML = payments.map(p => `
                    <div class="card card-p mb-2" style="border-left: 4px solid ${p.status === 'approved' ? 'var(--success)' : p.status === 'rejected' ? 'var(--danger)' : 'var(--gold)'};">
                        <div class="d-flex items-center justify-between flex-wrap" style="gap:.5rem;">
                            <div>
                                <strong>${p.type.charAt(0).toUpperCase() + p.type.slice(1)}</strong>
                                <span class="badge ${p.status === 'approved' ? 'badge-success' : p.status === 'rejected' ? 'badge-danger' : 'badge-gold'}">${p.status}</span>
                                <div style="font-size:.75rem;color:var(--text3);">Reference: ${p.reference}</div>
                                <div style="font-size:.75rem;color:var(--text3);">Amount: ${fmtMoneyAPI(p.amount)}</div>
                                <div style="font-size:.75rem;color:var(--text3);">Date: ${new Date(p.paymentDate).toLocaleDateString()}</div>
                                ${p.adminNote ? `<div style="font-size:.75rem;color:var(--text2);">Note: ${escapeHtml(p.adminNote)}</div>` : ''}
                            </div>
                            <a href="${p.receiptUrl}" target="_blank" class="btn btn-ghost btn-sm"><i class="fas fa-eye"></i> Receipt</a>
                        </div>
                    </div>
                `).join('');
    } catch (err) { toast('Failed to load manual payments: ' + err.message, 'error'); }
}

// Expose
window.loadUserManualPayments = loadUserManualPayments;
