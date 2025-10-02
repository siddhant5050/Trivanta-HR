// ============================================
// TRIVANTA ELITE CANDIDATE MANAGEMENT SYSTEM
// ============================================

// --- 1. FIREBASE CONFIGURATION & INITIALIZATION ---

const firebaseConfig = {
  apiKey: "AIzaSyAuaOWWzeD8ranEwesCWLnvU7RTVQzTb7w",
  authDomain: "trivanta-hr.firebaseapp.com",
  projectId: "trivanta-hr",
  storageBucket: "trivanta-hr.firebasestorage.app",
  messagingSenderId: "219158390843",
  appId: "1:219158390843:web:fe37020bbba5329340941e",
  measurementId: "G-Y2D14PC66D"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// --- 2. AUTHENTICATION CONFIGURATION ---

const ADMIN_EMAIL = 'siddhant@trivantaedge.com'; 
const VENDOR_DOMAIN = 'trivantaedge.com';

// --- 3. AUTHENTICATION FUNCTIONS ---

async function handleLogin(email, password) {
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;

        if (user.email === ADMIN_EMAIL) {
            window.location.href = 'admin.html';
        } else if (user.email.includes(VENDOR_DOMAIN)) {
            window.location.href = 'vendor.html';
        } else {
            alert('Access Denied. Unknown user role.');
            auth.signOut();
        }
    } catch (error) {
        alert(`Login Failed: ${error.message}`);
        console.error("Login Error:", error);
    }
}

function handleLogout() {
    auth.signOut().then(() => {
        window.location.href = 'index.html';
    }).catch((error) => {
        console.error("Logout Error:", error);
    });
}

function getVendorName(user) {
    if (!user) return "N/A";
    if (user.email === ADMIN_EMAIL) return "Admin";
    
    const emailPrefix = user.email.split('@')[0];
    
    // Check Firestore for vendor display name
    db.collection('vendors').where('email', '==', user.email).get()
        .then(snapshot => {
            if (!snapshot.empty) {
                const vendorData = snapshot.docs[0].data();
                return vendorData.displayName || emailPrefix;
            }
        });
    
    // Fallback formatting
    return emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1).replace(/(\d+)/g, ' $1');
}

// --- 4. VENDOR PORTAL LOGIC ---

auth.onAuthStateChanged(user => {
    if (document.getElementById('vendor-portal')) {
        if (user && user.email.includes(VENDOR_DOMAIN) && user.email !== ADMIN_EMAIL) {
            const vendorName = getVendorName(user);
            document.getElementById('vendor-name-display').textContent = vendorName;
            loadVendorCandidates(vendorName);
        } else if (user && user.email === ADMIN_EMAIL) {
            window.location.href = 'admin.html';
        } else {
            window.location.href = 'index.html';
        }
    }
});

async function addCandidate(event) {
    event.preventDefault();
    const user = auth.currentUser;
    if (!user) { 
        alert("User not logged in."); 
        return; 
    }

    const vendorName = getVendorName(user);
    const form = document.getElementById('candidateForm');
    const resumeFile = form.elements['resumeAttachment'].files[0];
    let resumeURL = '';

    // Show loading state
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    submitBtn.disabled = true;

    try {
        // Upload Resume if exists
        if (resumeFile) {
            const storageRef = storage.ref(`resumes/${vendorName}/${Date.now()}-${resumeFile.name}`);
            const snapshot = await storageRef.put(resumeFile);
            resumeURL = await snapshot.ref.getDownloadURL();
        }

        // Prepare Candidate Data
        const candidateData = {
            name: form.elements['name'].value,
            number: form.elements['number'].value,
            email: form.elements['email'].value,
            role: form.elements['role'].value,
            currentSalary: parseFloat(form.elements['currentSalary'].value) || 0,
            expectedSalary: parseFloat(form.elements['expectedSalary'].value) || 0,
            offeredSalary: parseFloat(form.elements['offeredSalary'].value) || 0,
            totalExperience: parseFloat(form.elements['totalExperience'].value) || 0,
            relevantExperience: parseFloat(form.elements['relevantExperience'].value) || 0,
            resumeURL: resumeURL,
            dateOfInterview: form.elements['dateOfInterview'].value,
            dateOfSelection: form.elements['dateOfSelection'].value,
            dateOfJoining: form.elements['dateOfJoining'].value,
            vendorName: vendorName,
            vendorEmail: user.email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('candidates').add(candidateData);
        
        // Show success message
        showNotification('Candidate added successfully!', 'success');
        form.reset();
        loadVendorCandidates(vendorName);
    } catch (error) {
        console.error("Error adding candidate:", error);
        showNotification('Failed to add candidate. Please try again.', 'error');
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

function loadVendorCandidates(vendorName) {
    const tableBody = document.getElementById('vendorCandidateTableBody');
    tableBody.innerHTML = '<tr><td colspan="8" class="text-center"><i class="fas fa-spinner fa-spin"></i> Loading candidates...</td></tr>';

    db.collection('candidates').where('vendorName', '==', vendorName).orderBy('createdAt', 'desc').onSnapshot(snapshot => {
        tableBody.innerHTML = '';
        if (snapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No candidates added yet. Add your first candidate above!</td></tr>';
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            const row = tableBody.insertRow();
            row.innerHTML = `
                <td><strong>${data.name}</strong></td>
                <td><span class="badge bg-primary">${data.role}</span></td>
                <td>${data.number}</td>
                <td>${data.email}</td>
                <td><strong>₹${data.offeredSalary.toLocaleString('en-IN')}</strong></td>
                <td>${data.totalExperience} yrs</td>
                <td>${data.dateOfJoining || 'N/A'}</td>
                <td>
                    <button class="btn btn-sm btn-info" onclick="generatePdf('${doc.id}')">
                        <i class="fas fa-file-pdf"></i> PDF
                    </button>
                </td>
            `;
        });
    }, error => {
        console.error("Error loading vendor candidates:", error);
        tableBody.innerHTML = '<tr><td colspan="8" class="text-danger text-center">Error loading data. Please refresh.</td></tr>';
    });
}

// --- 5. ADMIN PORTAL LOGIC ---

auth.onAuthStateChanged(user => {
    if (document.getElementById('admin-portal')) {
        if (user && user.email === ADMIN_EMAIL) {
            document.getElementById('admin-name-display').textContent = 'Administrator';
            loadAllCandidates();
            setupAnalyticsListener();
            loadVendorList();
        } else if (user && user.email.includes(VENDOR_DOMAIN)) {
            window.location.href = 'vendor.html';
        } else {
            window.location.href = 'index.html';
        }
    }
});

function loadAllCandidates() {
    const tableBody = document.getElementById('adminCandidateTableBody');
    tableBody.innerHTML = '<tr><td colspan="9" class="text-center"><i class="fas fa-spinner fa-spin"></i> Loading all candidates...</td></tr>';

    db.collection('candidates').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
        tableBody.innerHTML = '';
        if (snapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">No candidates in the system yet.</td></tr>';
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            const row = tableBody.insertRow();
            row.innerHTML = `
                <td><span class="badge bg-secondary">${data.vendorName}</span></td>
                <td><strong>${data.name}</strong></td>
                <td><span class="badge bg-primary">${data.role}</span></td>
                <td>${data.number}</td>
                <td>${data.email}</td>
                <td><strong>₹${data.offeredSalary.toLocaleString('en-IN')}</strong></td>
                <td>${data.totalExperience} yrs</td>
                <td>${data.dateOfJoining || 'N/A'}</td>
                <td>
                    <button class="btn btn-sm btn-info" onclick="generatePdf('${doc.id}')">
                        <i class="fas fa-file-pdf"></i>
                    </button>
                    <button class="btn btn-sm btn-danger ms-1" onclick="deleteCandidate('${doc.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
        });
    }, error => {
        console.error("Error loading all candidates:", error);
        tableBody.innerHTML = '<tr><td colspan="9" class="text-danger text-center">Error loading data. Please refresh.</td></tr>';
    });
}

function setupAnalyticsListener() {
    db.collection('candidates').onSnapshot(snapshot => {
        const vendorMap = {};
        const roleCount = {};
        let totalCandidates = 0;

        snapshot.forEach(doc => {
            totalCandidates++;
            const data = doc.data();
            
            vendorMap[data.vendorName] = (vendorMap[data.vendorName] || 0) + 1;
            roleCount[data.role] = (roleCount[data.role] || 0) + 1;
        });
        
        // Update Total Candidates KPI
        document.getElementById('total-candidates-kpi').textContent = totalCandidates;
        
        // Update Vendor Performance Table
        const vendorTableBody = document.getElementById('vendor-performance-body');
        vendorTableBody.innerHTML = '';
        Object.keys(vendorMap).sort((a,b) => vendorMap[b] - vendorMap[a]).forEach(vendor => {
            const row = vendorTableBody.insertRow();
            row.innerHTML = `
                <td>${vendor}</td>
                <td><span class="badge bg-success">${vendorMap[vendor]}</span></td>
            `;
        });
        
        // Update Role Distribution
        const roleList = document.getElementById('role-distribution-list');
        roleList.innerHTML = '';
        Object.keys(roleCount).sort((a,b) => roleCount[b] - roleCount[a]).forEach(role => {
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex justify-content-between align-items-center';
            li.innerHTML = `${role} <span class="badge bg-primary rounded-pill">${roleCount[role]}</span>`;
            roleList.appendChild(li);
        });
        
    }, error => {
        console.error("Error generating analytics:", error);
    });
}

// --- 6. VENDOR MANAGEMENT FUNCTIONS ---

async function addNewVendor(event) {
    event.preventDefault();
    
    const form = document.getElementById('addVendorForm');
    const vendorName = form.elements['vendorName'].value.trim();
    const vendorEmail = form.elements['vendorEmail'].value.trim().toLowerCase();
    const vendorPassword = form.elements['vendorPassword'].value;
    const vendorPhone = form.elements['vendorPhone'].value.trim();
    
    // Validation
    if (!vendorEmail.endsWith('@trivantaedge.com')) {
        showNotification('Email must end with @trivantaedge.com', 'error');
        return;
    }
    
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
    submitBtn.disabled = true;
    
    try {
        // Create Firebase Auth user
        const userCredential = await auth.createUserWithEmailAndPassword(vendorEmail, vendorPassword);
        
        // Store vendor details in Firestore
        await db.collection('vendors').add({
            displayName: vendorName,
            email: vendorEmail,
            phone: vendorPhone || '',
            uid: userCredential.user.uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: auth.currentUser.email,
            status: 'active'
        });
        
        showNotification('Vendor account created successfully!', 'success');
        form.reset();
        loadVendorList();
        
        // Sign admin back in
        await auth.signInWithEmailAndPassword(ADMIN_EMAIL, prompt('Enter your admin password to continue:'));
        
    } catch (error) {
        console.error("Error creating vendor:", error);
        if (error.code === 'auth/email-already-in-use') {
            showNotification('This email is already registered.', 'error');
        } else {
            showNotification(`Failed to create vendor: ${error.message}`, 'error');
        }
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

function loadVendorList() {
    const tableBody = document.getElementById('vendorListTableBody');
    if (!tableBody) return;
    
    tableBody.innerHTML = '<tr><td colspan="4" class="text-center"><i class="fas fa-spinner fa-spin"></i> Loading vendors...</td></tr>';
    
    db.collection('vendors').orderBy('createdAt', 'desc').onSnapshot(async snapshot => {
        tableBody.innerHTML = '';
        
        if (snapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No vendors registered yet.</td></tr>';
            return;
        }
        
        for (const doc of snapshot.docs) {
            const vendorData = doc.data();
            
            // Count candidates for this vendor
            const candidateCount = await db.collection('candidates')
                .where('vendorEmail', '==', vendorData.email)
                .get()
                .then(snap => snap.size);
            
            const row = tableBody.insertRow();
            row.innerHTML = `
                <td><strong>${vendorData.displayName}</strong></td>
                <td>${vendorData.email}</td>
                <td><span class="badge bg-info">${candidateCount}</span></td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="deleteVendor('${doc.id}', '${vendorData.email}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
        }
    }, error => {
        console.error("Error loading vendors:", error);
        tableBody.innerHTML = '<tr><td colspan="4" class="text-danger text-center">Error loading vendors.</td></tr>';
    });
}

async function deleteVendor(vendorDocId, vendorEmail) {
    if (!confirm(`Are you sure you want to delete this vendor? This will also delete all their candidates.`)) {
        return;
    }
    
    try {
        // Delete all candidates associated with this vendor
        const candidatesSnapshot = await db.collection('candidates')
            .where('vendorEmail', '==', vendorEmail)
            .get();
        
        const deletePromises = candidatesSnapshot.docs.map(doc => doc.ref.delete());
        await Promise.all(deletePromises);
        
        // Delete vendor document
        await db.collection('vendors').doc(vendorDocId).delete();
        
        showNotification('Vendor and all associated candidates deleted successfully.', 'success');
        
    } catch (error) {
        console.error("Error deleting vendor:", error);
        showNotification('Failed to delete vendor. Please try again.', 'error');
    }
}

async function deleteCandidate(candidateId) {
    if (!confirm('Are you sure you want to delete this candidate?')) {
        return;
    }
    
    try {
        await db.collection('candidates').doc(candidateId).delete();
        showNotification('Candidate deleted successfully.', 'success');
    } catch (error) {
        console.error("Error deleting candidate:", error);
        showNotification('Failed to delete candidate.', 'error');
    }
}

// --- 7. PDF GENERATION LOGIC ---

async function generatePdf(candidateId) {
    try {
        const candidateSnap = await db.collection('candidates').doc(candidateId).get();
        if (!candidateSnap.exists) {
            showNotification("Candidate not found.", 'error');
            return;
        }
        
        const data = candidateSnap.data();
        const doc = new jsPDF();
        
        // Header with Logo/Branding
        doc.setFillColor(10, 22, 40); // Navy
        doc.rect(0, 0, 210, 35, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont(undefined, 'bold');
        doc.text("TRIVANTA", 14, 15);
        
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.text("Executive Candidate Profile", 14, 22);
        
        // Gold line
        doc.setDrawColor(212, 175, 55);
        doc.setLineWidth(2);
        doc.line(14, 28, 196, 28);
        
        // Vendor Info
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(9);
        doc.text(`Submitted by: ${data.vendorName}`, 14, 32);
        doc.text(`Generated: ${new Date().toLocaleDateString()}`, 140, 32);
        
        // Candidate Details Table
        doc.setTextColor(0, 0, 0);
        const tableData = [
            ["CANDIDATE INFORMATION", ""],
            ["Full Name", data.name],
            ["Applied Role", data.role],
            ["Contact Number", data.number],
            ["Email Address", data.email],
            ["", ""],
            ["EXPERIENCE DETAILS", ""],
            ["Total Experience", `${data.totalExperience} years`],
            ["Relevant Experience", `${data.relevantExperience} years`],
            ["", ""],
            ["COMPENSATION DETAILS", ""],
            ["Current Salary", `₹${data.currentSalary.toLocaleString('en-IN')}`],
            ["Expected Salary", `₹${data.expectedSalary.toLocaleString('en-IN')}`],
            ["Offered Salary", `₹${data.offeredSalary.toLocaleString('en-IN')}`],
            ["", ""],
            ["TIMELINE", ""],
            ["Interview Date", data.dateOfInterview || 'Not Scheduled'],
            ["Selection Date", data.dateOfSelection || 'Not Selected'],
            ["Joining Date", data.dateOfJoining || 'Not Confirmed'],
            ["", ""],
            ["VENDOR INFORMATION", ""],
            ["Vendor Name", data.vendorName],
            ["Vendor Email", data.vendorEmail || 'N/A']
        ];
        
        doc.autoTable({
            startY: 40,
            body: tableData,
            theme: 'striped',
            styles: { 
                fontSize: 10, 
                cellPadding: 3,
                lineColor: [200, 200, 200],
                lineWidth: 0.1
            },
            columnStyles: {
                0: { fontStyle: 'bold', cellWidth: 70, fillColor: [245, 245, 245] },
                1: { cellWidth: 120 }
            },
            headStyles: { 
                fillColor: [10, 22, 40],
                textColor: 255,
                fontSize: 11,
                fontStyle: 'bold'
            },
            didParseCell: function(data) {
                // Header rows styling
                if (data.cell.raw === "CANDIDATE INFORMATION" || 
                    data.cell.raw === "EXPERIENCE DETAILS" || 
                    data.cell.raw === "COMPENSATION DETAILS" ||
                    data.cell.raw === "TIMELINE" ||
                    data.cell.raw === "VENDOR INFORMATION") {
                    data.cell.styles.fillColor = [30, 58, 95];
                    data.cell.styles.textColor = [255, 255, 255];
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fontSize = 11;
                }
            }
        });
        
        // Footer
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(
                `Trivanta Candidate Manager | Confidential Document | Page ${i} of ${pageCount}`,
                doc.internal.pageSize.width / 2,
                doc.internal.pageSize.height - 10,
                { align: 'center' }
            );
        }
        
        doc.save(`Trivanta_${data.name.replace(/\s/g, '_')}_${Date.now()}.pdf`);
        showNotification('PDF generated successfully!', 'success');
        
    } catch (error) {
        console.error("Error generating PDF:", error);
        showNotification('Failed to generate PDF.', 'error');
    }
}

// --- 8. EXPORT TO CSV FUNCTIONS ---

async function exportToCSV() {
    try {
        const snapshot = await db.collection('candidates').orderBy('createdAt', 'desc').get();
        
        if (snapshot.empty) {
            showNotification('No data to export.', 'error');
            return;
        }
        
        let csvContent = "Vendor,Candidate Name,Role,Phone,Email,Current Salary,Expected Salary,Offered Salary,Total Experience,Relevant Experience,Interview Date,Selection Date,Joining Date\n";
        
        snapshot.forEach(doc => {
            const data = doc.data();
            csvContent += `"${data.vendorName}","${data.name}","${data.role}","${data.number}","${data.email}",${data.currentSalary},${data.expectedSalary},${data.offeredSalary},${data.totalExperience},${data.relevantExperience},"${data.dateOfInterview || ''}","${data.dateOfSelection || ''}","${data.dateOfJoining || ''}"\n`;
        });
        
        downloadCSV(csvContent, `Trivanta_All_Candidates_${Date.now()}.csv`);
        showNotification('Data exported successfully!', 'success');
        
    } catch (error) {
        console.error("Error exporting data:", error);
        showNotification('Failed to export data.', 'error');
    }
}

async function exportVendorData() {
    try {
        const user = auth.currentUser;
        if (!user) return;
        
        const vendorName = getVendorName(user);
        const snapshot = await db.collection('candidates')
            .where('vendorName', '==', vendorName)
            .orderBy('createdAt', 'desc')
            .get();
        
        if (snapshot.empty) {
            showNotification('No data to export.', 'error');
            return;
        }
        
        let csvContent = "Candidate Name,Role,Phone,Email,Current Salary,Expected Salary,Offered Salary,Total Experience,Relevant Experience,Interview Date,Selection Date,Joining Date\n";
        
        snapshot.forEach(doc => {
            const data = doc.data();
            csvContent += `"${data.name}","${data.role}","${data.number}","${data.email}",${data.currentSalary},${data.expectedSalary},${data.offeredSalary},${data.totalExperience},${data.relevantExperience},"${data.dateOfInterview || ''}","${data.dateOfSelection || ''}","${data.dateOfJoining || ''}"\n`;
        });
        
        downloadCSV(csvContent, `${vendorName}_Candidates_${Date.now()}.csv`);
        showNotification('Data exported successfully!', 'success');
        
    } catch (error) {
        console.error("Error exporting vendor data:", error);
        showNotification('Failed to export data.', 'error');
    }
}

function downloadCSV(csvContent, filename) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- 9. NOTIFICATION SYSTEM ---

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `alert alert-${type === 'error' ? 'danger' : type === 'success' ? 'success' : 'info'} position-fixed top-0 start-50 translate-middle-x mt-3`;
    notification.style.zIndex = '9999';
    notification.style.minWidth = '300px';
    notification.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)';
    
    const icon = type === 'error' ? 'fa-exclamation-circle' : type === 'success' ? 'fa-check-circle' : 'fa-info-circle';
    
    notification.innerHTML = `
        <i class="fas ${icon} me-2"></i>
        ${message}
        <button type="button" class="btn-close" onclick="this.parentElement.remove()"></button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// --- 10. INITIALIZATION ---

console.log('Trivanta Elite Candidate Management System Initialized');
console.log('© 2025 Trivanta Edge - All Rights Reserved');