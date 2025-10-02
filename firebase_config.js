// Firebase configuration and initialization
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    getDocs, 
    doc, 
    getDoc,
    setDoc, 
    updateDoc, 
    deleteDoc, 
    query, 
    where, 
    orderBy,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { 
    getStorage, 
    ref, 
    uploadBytes, 
    getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// Firebase configuration
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
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// Firebase utility functions
class FirebaseService {
    // Vendor operations
    static async addVendor(vendorData) {
        try {
            const docRef = await setDoc(doc(db, 'vendors', vendorData.username), {
                ...vendorData,
                createdAt: serverTimestamp()
            });
            return { success: true, id: vendorData.username };
        } catch (error) {
            console.error('Error adding vendor:', error);
            return { success: false, error: error.message };
        }
    }

    static async getVendors() {
        try {
            const querySnapshot = await getDocs(collection(db, 'vendors'));
            const vendors = [];
            querySnapshot.forEach((doc) => {
                vendors.push({ id: doc.id, ...doc.data() });
            });
            return vendors;
        } catch (error) {
            console.error('Error getting vendors:', error);
            return [];
        }
    }

    static async getVendorByCredentials(username, password) {
        try {
            const q = query(
                collection(db, 'vendors'), 
                where('username', '==', username),
                where('password', '==', password)
            );
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                const doc = querySnapshot.docs[0];
                return { id: doc.id, ...doc.data() };
            }
            return null;
        } catch (error) {
            console.error('Error getting vendor:', error);
            return null;
        }
    }

    static async deleteVendor(vendorId) {
        try {
            await deleteDoc(doc(db, 'vendors', vendorId));
            return { success: true };
        } catch (error) {
            console.error('Error deleting vendor:', error);
            return { success: false, error: error.message };
        }
    }

    // Candidate operations
    static async addCandidate(candidateData) {
        try {
            const docRef = await addDoc(collection(db, 'candidates'), {
                ...candidateData,
                createdAt: serverTimestamp()
            });
            return { success: true, id: docRef.id };
        } catch (error) {
            console.error('Error adding candidate:', error);
            return { success: false, error: error.message };
        }
    }

    static async getCandidates() {
        try {
            const q = query(collection(db, 'candidates'), orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            const candidates = [];
            querySnapshot.forEach((doc) => {
                candidates.push({ id: doc.id, ...doc.data() });
            });
            return candidates;
        } catch (error) {
            console.error('Error getting candidates:', error);
            return [];
        }
    }

    static async getCandidatesByVendor(vendorId) {
        try {
            const q = query(
                collection(db, 'candidates'), 
                where('vendorId', '==', vendorId),
                orderBy('createdAt', 'desc')
            );
            const querySnapshot = await getDocs(q);
            const candidates = [];
            querySnapshot.forEach((doc) => {
                candidates.push({ id: doc.id, ...doc.data() });
            });
            return candidates;
        } catch (error) {
            console.error('Error getting vendor candidates:', error);
            return [];
        }
    }

    static async updateCandidate(candidateId, candidateData) {
        try {
            await updateDoc(doc(db, 'candidates', candidateId), {
                ...candidateData,
                updatedAt: serverTimestamp()
            });
            return { success: true };
        } catch (error) {
            console.error('Error updating candidate:', error);
            return { success: false, error: error.message };
        }
    }

    static async deleteCandidate(candidateId) {
        try {
            await deleteDoc(doc(db, 'candidates', candidateId));
            return { success: true };
        } catch (error) {
            console.error('Error deleting candidate:', error);
            return { success: false, error: error.message };
        }
    }

    // File upload
    static async uploadResume(file, candidateId) {
        try {
            const storageRef = ref(storage, `resumes/${candidateId}_${file.name}`);
            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);
            return { success: true, url: downloadURL };
        } catch (error) {
            console.error('Error uploading file:', error);
            return { success: false, error: error.message };
        }
    }

    // Initialize demo data
    static async initializeDemoData() {
        try {
            // Check if demo data already exists
            const vendorsSnapshot = await getDocs(collection(db, 'vendors'));
            const candidatesSnapshot = await getDocs(collection(db, 'candidates'));
            
            if (vendorsSnapshot.empty) {
                // Add demo vendors
                await this.addVendor({
                    username: 'testvendor',
                    name: 'Test Vendor Company',
                    password: 'password'
                });
                
                await this.addVendor({
                    username: 'abcsolutions',
                    name: 'ABC Solutions',
                    password: 'abc123'
                });
                
                console.log('Demo vendors added');
            }
            
            if (candidatesSnapshot.empty) {
                // Add demo candidates
                await this.addCandidate({
                    vendorId: 'testvendor',
                    vendorName: 'Test Vendor Company',
                    name: 'John Doe',
                    number: '9876543210',
                    email: 'john.doe@email.com',
                    role: 'Fitter',
                    currentSalary: 25000,
                    expectedSalary: 30000,
                    offeredSalary: 32000,
                    totalExperience: 3.5,
                    relevantExperience: 2.5,
                    resumeURL: null,
                    interviewDate: '2024-01-15',
                    selectionDate: '2024-01-20',
                    joiningDate: null,
                    status: 'Selected'
                });
                
                await this.addCandidate({
                    vendorId: 'testvendor',
                    vendorName: 'Test Vendor Company',
                    name: 'Jane Smith',
                    number: '9876543211',
                    email: 'jane.smith@email.com',
                    role: 'Welder',
                    currentSalary: 22000,
                    expectedSalary: 28000,
                    offeredSalary: null,
                    totalExperience: 2.0,
                    relevantExperience: 1.5,
                    resumeURL: null,
                    interviewDate: '2024-01-25',
                    selectionDate: null,
                    joiningDate: null,
                    status: 'Interview Pending'
                });
                
                console.log('Demo candidates added');
            }
            
            return { success: true };
        } catch (error) {
            console.error('Error initializing demo data:', error);
            return { success: false, error: error.message };
        }
    }
}

// Make FirebaseService available globally
window.FirebaseService = FirebaseService;