/* =========================================================
   Admin Logic & QR Scanner - Royal Mess
   ========================================================= */

let html5QrCode;
let currentScannedStudentId = null;

// Page load hote hi scanner start karo aur live data dekho
document.addEventListener("DOMContentLoaded", () => {
  initScanner();
  listenLiveCounts();
});

// 1. Initialize QR Scanner
function initScanner() {
  html5QrCode = new Html5Qrcode("reader");
  
  const config = { fps: 10, qrbox: { width: 250, height: 250 } };
  
  // Back camera (environment) open karne ka try karega
  html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess)
  .catch(err => {
    console.log("Camera start error:", err);
    document.getElementById("reader").innerHTML = "<p class='text-red-500 p-4'>Camera permission allow karein.</p>";
  });
}

// 2. Audio Beep Generator (Bina kisi MP3 file ke sound banayega)
function playBeep(isUnpaid = false) {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return; // Agar browser purana hai toh ignore karo
  
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  if (isUnpaid) {
    // RED ALERT SOUND: Low tone heavy siren
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.5);
    osc.type = 'sawtooth';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    osc.start();
    osc.stop(ctx.currentTime + 0.8);
  } else {
    // SUCCESS SOUND: Short sweet beep
    osc.frequency.value = 800; 
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  }
}

// 3. Jab QR Code Successfully Scan ho jaye
function onScanSuccess(decodedText) {
  // Agar modal pehle se khula hai, toh naya scan ignore karo
  if (currentScannedStudentId) return; 
  
  currentScannedStudentId = decodedText;
  
  // Pause scanner taaki double scan na ho jaye
  html5QrCode.pause(true);
  
  // Halka sa vibration agar phone support karta hai
  if (navigator.vibrate) navigator.vibrate(100);

  // Firebase se student ka data nikalo (Simulated here for now)
  // Real implementation me yahan db.collection("users").doc(decodedText).get() hoga
  db.collection("users").doc(decodedText).get().then(doc => {
    // Agar database me student nahi hai toh default banalo
    const data = doc.exists ? doc.data() : { 
      name: "Student: " + decodedText.substring(0,6), 
      phone: "No Registered Phone", 
      fees_paid: true 
    };
    
    // UI Update karo
    document.getElementById("scannedName").innerText = data.name;
    document.getElementById("scannedPhone").innerText = data.phone;
    // UI Avatars use karke initial ka photo lagao
    document.getElementById("scannedPhoto").src = `https://ui-avatars.com/api/?name=${data.name}&background=random&size=150`;
    
    const modalCard = document.getElementById("modalCard");
    const statusBadge = document.getElementById("scannedStatus");
    
    // -- THE 5TH DATE RULE LOGIC --
    const todayDate = new Date().getDate();
    
    if (!data.fees_paid && todayDate >= 5) {
      // Unpaid Condition (Red Siren)
      statusBadge.innerText = "⚠️ UNPAID - CHECK FEES";
      statusBadge.className = "inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-black bg-red-600 text-white shadow-md";
      modalCard.classList.add("unpaid-alert-card"); // CSS animation class
      playBeep(true); 
    } else {
      // Paid Condition (Green Normal)
      statusBadge.innerText = "✅ PAID MEMBER";
      statusBadge.className = "inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-700";
      modalCard.classList.remove("unpaid-alert-card");
      playBeep(false); 
    }
    
    // Modal Open Animation Classes (Bottom Sheet)
    document.getElementById("scanResultModal").classList.remove("hidden");
    // Thoda delay taaki display:block apply hone ke baad transition ho
    setTimeout(() => {
      document.getElementById("scanResultModal").classList.add("modal-bg-open");
      document.getElementById("modalCard").classList.add("modal-card-open");
    }, 10);

  }).catch(err => {
    alert("Database Error: " + err.message);
    closeModal();
  });
}

// 4. Staff Button Clicks: Dine-In ya Tiffin confirm karna
function confirmAttendance(mode) {
  if (!currentScannedStudentId) return;
  
  const todayStr = new Date().toISOString().split('T')[0];
  
  // Firebase me entry daalo
  db.collection("attendance").add({
    student_id: currentScannedStudentId,
    mode: mode,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    date: todayStr
  }).then(() => {
    closeModal();
  }).catch(err => {
    alert("Attendance save nahi hui: " + err.message);
  });
}

// 5. Modal Band Karna aur Scanner wapas on karna
function closeModal() {
  // Close Animation Classes
  document.getElementById("scanResultModal").classList.remove("modal-bg-open");
  document.getElementById("modalCard").classList.remove("modal-card-open");
  
  setTimeout(() => {
    document.getElementById("scanResultModal").classList.add("hidden");
    currentScannedStudentId = null;
    // Scanner wapas resume karo agle student ke liye
    if (html5QrCode.getState() === 2) { // 2 = PAUSED
      html5QrCode.resume();
    }
  }, 300); // 300ms transition delay match
}

// 6. Live Headcount Listener (Kitchen ke liye kitna bana hai)
function listenLiveCounts() {
  const todayStr = new Date().toISOString().split('T')[0];
  
  db.collection("attendance").where("date", "==", todayStr).onSnapshot(snapshot => {
    let dineIn = 0;
    let tiffin = 0;
    
    snapshot.forEach(doc => {
      if (doc.data().mode === 'DINE_IN') dineIn++;
      if (doc.data().mode === 'TIFFIN') tiffin++;
    });
    
    // Animate numbers smoothly
    document.getElementById("countDineIn").innerText = dineIn;
    document.getElementById("countTiffin").innerText = tiffin;
    document.getElementById("countTotal").innerText = dineIn + tiffin;
  });
}

// 7. Kitchen Refill Pause (Duniya bhar ke students ko notify karne ke liye)
function toggleRefillPause() {
  const btn = document.getElementById("refillBtn");
  const icon = document.getElementById("refillIcon");
  const text = document.getElementById("refillText");
  
  const isCurrentlyPaused = text.innerText.includes("Resume");
  const newStatus = !isCurrentlyPaused;
  
  db.collection("system").doc("status").set({
    refill_paused: newStatus
  }, { merge: true });
  
  if (newStatus) {
    btn.className = "bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg transition-all active:scale-95 flex items-center gap-1.5";
    icon.innerText = "▶️";
    text.innerText = "Resume Kitchen";
  } else {
    btn.className = "bg-amber-500 hover:bg-amber-400 text-amber-950 px-4 py-2 rounded-xl text-xs font-bold shadow-lg transition-all active:scale-95 flex items-center gap-1.5";
    icon.innerText = "⏸️";
    text.innerText = "Pause Kitchen";
  }
}
