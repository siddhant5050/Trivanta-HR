// --- 1. FIREBASE CONFIGURATION & INITIALIZATION ---

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAuaOWWzeD8ranEwesCWLnvU7RTVQzTb7w",
  authDomain: "trivanta-hr.firebaseapp.com",
  projectId: "trivanta-hr",
  storageBucket: "trivanta-hr.firebasestorage.app",
  messagingSenderId: "219158390843",
  appId: "1:219158390843:web:fe37020bbba5329340941e",
  measurementId: "G-Y2D14PC66D"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// --- 2. AUTHENTICATION (Shared Logic) ---

// Placeholder for Admin/Vendor Emails for demo purposes
// In a real system, use Firebase Custom Claims or a separate user collection.
const ADMIN_EMAIL = 'admin@trivanta.com';
const VENDOR_PREFIX = 'vendor'; // E.g., 'vendor1@trivanta.com'

async function handleLogin(email, password) {
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;

        if (user.email === ADMIN_EMAIL) {
            window.location.href = 'admin.html';
        } else if (user.email.includes(VENDOR_PREFIX)) {
            window.location.href = 'vendor.html';
        } else {
            alert('Access Denied. Unknown user role.');
            auth.signOut();
        }
    } catch (error) {
        alert(`Login Failed: ${error.message}`);
    }
}

function handleLogout() {
    auth.signOut().then(() => {
        window.location.href = 'index.html';
    }).catch((error) => {
        console.error("Logout Error:", error);
    });
}

// --- 3. VENDOR PORTAL LOGIC ---

// Get current vendor name from auth (simplified)
function getVendorName(user) {
    if (!user) return "N/A";
    if (user.email === ADMIN_EMAIL) return "Admin";
    // Example: converts vendor1@trivanta.com to 'Vendor 1'
    return user.email.split('@')[0].replace('vendor', 'Vendor ');
}

// Attach listener to check auth state and load Vendor data
auth.onAuthStateChanged(user => {
    if (document.getElementById('vendor-portal')) {
        if (user && user.email.includes(VENDOR_PREFIX)) {
            const vendorName = getVendorName(user);
            document.getElementById('vendor-name-display').textContent = vendorName;
            loadVendorCandidates(vendorName);
        } else if (user && user.email === ADMIN_EMAIL) {
             // Redirect admin away if they land here
             window.location.href = 'admin.html';
        } else {
            window.location.href = 'index.html';
        }
    }
});

async function addCandidate(event) {
    event.preventDefault();
    const user = auth.currentUser;
    if (!user) { return alert("User not logged in."); }

    const vendorName = getVendorName(user);
    const form = document.getElementById('candidateForm');
    const resumeFile = form.elements['resumeAttachment'].files[0];
    let resumeURL = '';

    // 1. Upload Resume (if exists)
    if (resumeFile) {
        const storageRef = storage.ref(`resumes/${vendorName}/${Date.now()}-${resumeFile.name}`);
        const snapshot = await storageRef.put(resumeFile);
        resumeURL = await snapshot.ref.getDownloadURL();
    }

    // 2. Prepare Candidate Data
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
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    // 3. Save to Firestore
    try {
        await db.collection('candidates').add(candidateData);
        alert('Candidate added successfully!');
        form.reset();
        loadVendorCandidates(vendorName); // Refresh the table
    } catch (error) {
        console.error("Error adding document: ", error);
        alert('Failed to add candidate. Check console for details.');
    }
}

function loadVendorCandidates(vendorName) {
    const tableBody = document.getElementById('vendorCandidateTableBody');
    tableBody.innerHTML = '<tr><td colspan="12">Loading candidates...</td></tr>';

    db.collection('candidates').where('vendorName', '==', vendorName).onSnapshot(snapshot => {
        tableBody.innerHTML = '';
        if (snapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="12" class="text-center">No candidates added yet.</td></tr>';
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            const row = tableBody.insertRow();
            row.innerHTML = `
                <td>${data.name}</td>
                <td>${data.role}</td>
                <td>${data.number}</td>
                <td>${data.email}</td>
                <td>${data.offeredSalary.toLocaleString()}</td>
                <td>${data.totalExperience} years</td>
                <td>${data.dateOfJoining || 'N/A'}</td>
                <td><a href="#" class="btn btn-sm btn-info" onclick="generatePdf('${doc.id}')"><i class="fas fa-file-pdf"></i> PDF</a></td>
            `;
        });
    }, error => {
        console.error("Error loading vendor candidates:", error);
        tableBody.innerHTML = '<tr><td colspan="12" class="text-danger">Error loading data.</td></tr>';
    });
}

// --- 4. ADMIN PORTAL LOGIC ---

auth.onAuthStateChanged(user => {
    if (document.getElementById('admin-portal')) {
        if (user && user.email === ADMIN_EMAIL) {
            document.getElementById('admin-name-display').textContent = 'Admin';
            loadAllCandidates();
            setupAnalyticsListener();
        } else if (user && user.email.includes(VENDOR_PREFIX)) {
             // Redirect vendor away if they land here
             window.location.href = 'vendor.html';
        } else {
            window.location.href = 'index.html';
        }
    }
});

function loadAllCandidates() {
    const tableBody = document.getElementById('adminCandidateTableBody');
    tableBody.innerHTML = '<tr><td colspan="13">Loading all candidates...</td></tr>';

    db.collection('candidates').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
        tableBody.innerHTML = '';
        if (snapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="13" class="text-center">No candidates in the system.</td></tr>';
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            const row = tableBody.insertRow();
            row.innerHTML = `
                <td>${data.vendorName}</td>
                <td>${data.name}</td>
                <td>${data.role}</td>
                <td>${data.offeredSalary.toLocaleString()}</td>
                <td>${data.totalExperience} years</td>
                <td>${data.dateOfJoining || 'N/A'}</td>
                <td><a href="#" class="btn btn-sm btn-info" onclick="generatePdf('${doc.id}')"><i class="fas fa-file-pdf"></i> PDF</a></td>
            `;
        });
    }, error => {
        console.error("Error loading all candidates:", error);
        tableBody.innerHTML = '<tr><td colspan="13" class="text-danger">Error loading data.</td></tr>';
    });
}

// Analytics Setup
function setupAnalyticsListener() {
    db.collection('candidates').onSnapshot(snapshot => {
        const vendorMap = {};
        const roleCount = {};
        let totalCandidates = 0;

        snapshot.forEach(doc => {
            totalCandidates++;
            const data = doc.data();
            
            // Vendor Performance
            vendorMap[data.vendorName] = (vendorMap[data.vendorName] || 0) + 1;
            
            // Role Distribution
            roleCount[data.role] = (roleCount[data.role] || 0) + 1;
        });
        
        // Update Total Candidates KPI
        document.getElementById('total-candidates-kpi').textContent = totalCandidates;
        
        // Update Vendor Performance Table
        const vendorTableBody = document.getElementById('vendor-performance-body');
        vendorTableBody.innerHTML = '';
        Object.keys(vendorMap).sort((a,b) => vendorMap[b] - vendorMap[a]).forEach(vendor => {
            const row = vendorTableBody.insertRow();
            row.innerHTML = `<td>${vendor}</td><td>${vendorMap[vendor]}</td>`;
        });
        
        // Update Role Distribution Chart (Simple List for this implementation)
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

// --- 5. PDF GENERATION LOGIC ---

// This relies on the 'jspdf' and 'jspdf-autotable' libraries included in the HTML.
async function generatePdf(candidateId) {
    const doc = new jsPDF();
    const candidateSnap = await db.collection('candidates').doc(candidateId).get();
    if (!candidateSnap.exists) {
        return alert("Candidate not found for PDF generation.");
    }
    
    const data = candidateSnap.data();
    
    // Header
    doc.setFontSize(18);
    doc.text("Trivanta Candidate Profile", 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated by: ${data.vendorName}`, 14, 25);
    
    // Candidate Details Table
    const tableData = [
        ["Field", "Value"],
        ["Candidate Name", data.name],
        ["Role Applied For", data.role],
        ["Contact Number", data.number],
        ["Email Address", data.email],
        ["Total Experience", `${data.totalExperience} years`],
        ["Relevant Experience", `${data.relevantExperience} years`],
        ["Current Salary (INR)", data.currentSalary.toLocaleString()],
        ["Expected Salary (INR)", data.expectedSalary.toLocaleString()],
        ["Offered Salary (INR)", data.offeredSalary.toLocaleString()],
        ["Date of Interview", data.dateOfInterview || 'N/A'],
        ["Date of Selection", data.dateOfSelection || 'N/A'],
        ["Date of Joining", data.dateOfJoining || 'N/A'],
        ["Vendor Name", data.vendorName]
    ];
    
    doc.autoTable({
        startY: 35,
        head: [['Field', 'Value']],
        body: tableData.slice(1),
        theme: 'grid',
        styles: { fontSize: 10, cellPadding: 2 },
        headStyles: { fillColor: [0, 51, 102], textColor: 255 } // Corporate Blue Header
    });

    doc.save(`Trivanta_Candidate_${data.name.replace(/\s/g, '_')}.pdf`);
}
  
