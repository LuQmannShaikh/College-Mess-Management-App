/* =========================================================
   Student App Logic - Royal Mess
   ========================================================= */

// Student Unique ID (Normally assigned or stored after login)
const currentStudentId = localStorage.getItem("mess_student_id") || "STUDENT_101";

document.addEventListener("DOMContentLoaded", () => {
  // Save ID locally for persistent identity
  localStorage.setItem("mess_student_id", currentStudentId);
  
  // 1. Generate Student QR Code
  generateQRCode(currentStudentId);

  // 2. Fetch Profile & Payment Status from Database
  loadStudentProfile(currentStudentId);

  // 3. Real-time Listener for Kitchen Refill Alerts
  listenToKitchenStatus();
});

// 1. QR Code Generator Function
function generateQRCode(studentId) {
  const qrContainer = document.getElementById("qrcode");
  const qrLoading = document.getElementById("qrLoading");

  qrContainer.innerHTML = ""; // Clear existing QR canvas

  new QRCode(qrContainer, {
    text: studentId,
    width: 160,
    height: 160,
    colorDark: "#1e1b4b", // Deep indigo color for high scanner contrast
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });

  // Hide loading spinner once rendered
  if (qrLoading) {
    qrLoading.classList.add("hidden");
  }
}

// 2. Fetch Student Profile & Fee Status
function loadStudentProfile(studentId) {
  db.collection("users").doc(studentId).get().then(doc => {
    if (doc.exists) {
      const data = doc.data();
      document.getElementById("userName").innerText = data.name || "Rahul Sharma";
      document.getElementById("userPhone").innerText = data.phone || "+91 98765 43210";
      
      if (data.photo_url) {
        document.getElementById("userPhoto").src = data.photo_url;
      } else {
        document.getElementById("userPhoto").src = `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name || 'Student')}&background=random&size=150`;
      }

      // Check Payment Status (5th Date Rule)
      const statusBadge = document.getElementById("statusBadge");
      const todayDate = new Date().getDate();

      if (!data.fees_paid && todayDate >= 5) {
        statusBadge.innerText = "UNPAID";
        statusBadge.className = "absolute -bottom-1 -right-2 bg-red-600 text-white text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider shadow-md border-2 border-white animate-pulse";
      } else {
        statusBadge.innerText = "PAID";
        statusBadge.className = "absolute -bottom-1 -right-2 bg-green-500 text-white text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider shadow-md border-2 border-white";
      }

      // Highlight selected meal mode if already set
      if (data.preferred_mode) {
        highlightSelectedMeal(data.preferred_mode);
      }
    } else {
      // Default initial display if student doc doesn't exist yet
      document.getElementById("userName").innerText = "Rahul Sharma";
      document.getElementById("userPhone").innerText = "+91 98765 43210";
    }
  }).catch(err => {
    console.error("Profile load error:", err);
  });
}

// 3. Set Meal Preference (Dine-In vs Tiffin)
function setMealMode(mode) {
  highlightSelectedMeal(mode);

  const modeText = mode === 'DINE_IN' ? '🍽️ Dine-In' : '📦 Tiffin Pack';
  
  // Save selection directly to Firestore
  db.collection("users").doc(currentStudentId).set({
    preferred_mode: mode,
    last_updated: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true }).then(() => {
    showToast(`${modeText} selected for today!`, "✅");
  }).catch(err => {
    showToast("Failed to save selection", "❌");
  });
}

// Highlight buttons visually on tap
function highlightSelectedMeal(mode) {
  const btnDineIn = document.getElementById("btnDineIn");
  const btnTiffin = document.getElementById("btnTiffin");

  if (mode === 'DINE_IN') {
    btnDineIn.className = "group relative overflow-hidden p-4 rounded-2xl bg-indigo-600 border-2 border-indigo-600 text-white shadow-lg transition-all duration-200 active:scale-95 flex flex-col items-center gap-2";
    btnDineIn.querySelector("span:nth-child(2)").className = "font-bold text-sm text-white";
    btnDineIn.querySelector("span:nth-child(3)").className = "text-[10px] text-indigo-200 font-medium";

    btnTiffin.className = "group relative overflow-hidden p-4 rounded-2xl bg-orange-50 border-2 border-transparent hover:border-orange-500 transition-all duration-200 active:scale-95 flex flex-col items-center gap-2";
    btnTiffin.querySelector("span:nth-child(2)").className = "font-bold text-sm text-orange-900";
    btnTiffin.querySelector("span:nth-child(3)").className = "text-[10px] text-orange-500 font-medium";
  } else if (mode === 'TIFFIN') {
    btnTiffin.className = "group relative overflow-hidden p-4 rounded-2xl bg-orange-500 border-2 border-orange-500 text-white shadow-lg transition-all duration-200 active:scale-95 flex flex-col items-center gap-2";
    btnTiffin.querySelector("span:nth-child(2)").className = "font-bold text-sm text-white";
    btnTiffin.querySelector("span:nth-child(3)").className = "text-[10px] text-orange-100 font-medium";

    btnDineIn.className = "group relative overflow-hidden p-4 rounded-2xl bg-indigo-50 border-2 border-transparent hover:border-indigo-600 transition-all duration-200 active:scale-95 flex flex-col items-center gap-2";
    btnDineIn.querySelector("span:nth-child(2)").className = "font-bold text-sm text-indigo-900";
    btnDineIn.querySelector("span:nth-child(3)").className = "text-[10px] text-indigo-500 font-medium";
  }
}

// 4. Leave / Skip Meal Feature
function toggleSkipMeal() {
  const confirmSkip = confirm("✈️ Kya aap aaj ka khana skip kar rahe hain?\n\nIsse mess owner ko pata chal jayega aur ration waste nahi hoga.");
  
  if (confirmSkip) {
    const todayStr = new Date().toISOString().split('T')[0];

    db.collection("skips").add({
      student_id: currentStudentId,
      date: todayStr,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
      showToast("Leave recorded! Owner notified.", "✈️");
    }).catch(err => {
      showToast("Error recording leave", "❌");
    });
  }
}

// 5. Live Kitchen Status Listener
function listenToKitchenStatus() {
  db.collection("system").doc("status").onSnapshot(doc => {
    const alertBox = document.getElementById("kitchenAlert");
    if (doc.exists && doc.data().refill_paused) {
      alertBox.classList.remove("hidden");
    } else {
      alertBox.classList.add("hidden");
    }
  });
}

// 6. Native-Style Toast Notification Helper
function showToast(message, icon = "✅") {
  const toast = document.getElementById("toastMessage");
  const toastText = document.getElementById("toastText");
  const toastIcon = document.getElementById("toastIcon");

  toastText.innerText = message;
  toastIcon.innerText = icon;

  toast.classList.remove("opacity-0", "pointer-events-none");
  toast.classList.add("toast-enter");

  setTimeout(() => {
    toast.classList.remove("toast-enter");
    toast.classList.add("opacity-0", "pointer-events-none");
  }, 3000);
}
