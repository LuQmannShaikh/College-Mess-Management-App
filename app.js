/* =========================================================
   Unified Single Page Mess App Logic (Royal Mess)
   ========================================================= */

let currentUser = null;

document.addEventListener("DOMContentLoaded", () => {
  // Set default today's date in Admin form
  const today = new Date().toISOString().split('T')[0];
  if(document.getElementById("aJoiningDate")) {
    document.getElementById("aJoiningDate").value = today;
  }

  // Event Listeners
  document.getElementById("studentLoginForm")?.addEventListener("submit", handleStudentLogin);
  document.getElementById("adminLoginForm")?.addEventListener("submit", handleAdminLogin);
  document.getElementById("addStudentFormAdmin")?.addEventListener("submit", addStudentAdmin);

  // Check saved session
  const savedRole = localStorage.getItem("mess_role");
  const savedPhone = localStorage.getItem("mess_phone");

  if (savedRole === "admin") {
    showScreen("adminDashboard");
    loadAdminDashboard();
  } else if (savedRole === "student" && savedPhone) {
    loginStudentByPhone(savedPhone);
  }
});

function showScreen(screenId) {
  const screens = ["roleSelectionScreen", "studentLoginScreen", "adminLoginScreen", "studentDashboard", "adminDashboard"];
  screens.forEach(id => {
    const el = document.getElementById(id);
    if(el) el.classList.add("hidden");
  });
  document.getElementById(screenId)?.classList.remove("hidden");
}

/* --- STUDENT LOGIC --- */
function handleStudentLogin(e) {
  e.preventDefault();
  const phone = document.getElementById("studentPhoneInput").value.trim();
  if(!phone) return;
  loginStudentByPhone(phone);
}

function loginStudentByPhone(phone) {
  db.collection("users").doc(phone).get().then(doc => {
    if(doc.exists) {
      currentUser = { id: doc.id, ...doc.data() };
      localStorage.setItem("mess_role", "student");
      localStorage.setItem("mess_phone", phone);
      setupStudentDashboard();
      showScreen("studentDashboard");
    } else {
      alert("Mobile number not registered by Mess Admin!");
    }
  }).catch(err => alert("Error logging in: " + err.message));
}

function setupStudentDashboard() {
  document.getElementById("sNameDisplay").innerText = currentUser.name || "Student";
  document.getElementById("sCycleDisplay").innerText = `Month Starts: ${currentUser.payment_date || 'N/A'}`;

  // Smart Fee Payment Alerts Logic
  checkFeeAlerts(currentUser);
}

function checkFeeAlerts(user) {
  const total = user.total_fee || 2200;
  const paid = user.paid_amount || 0;
  const due = total - paid;

  if (due <= 0) return; // No alert if fully paid

  const startDate = new Date(user.payment_date || Date.now());
  const today = new Date();
  const diffDays = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));

  const isHalfPaid = paid >= (total / 2);
  const alertThreshold = isHalfPaid ? 15 : 8; // 15 days if >= 50% paid, else 8 days

  if (diffDays >= alertThreshold) {
    const banner = document.getElementById("feeAlertBanner");
    const text = document.getElementById("feeAlertText");
    banner.classList.remove("hidden");
    text.innerText = `Your pending fee is ₹${due}. Month cycle started ${diffDays} days ago. Please pay soon.`;
  }
}

function setMealType(type) {
  if(!currentUser) return;
  db.collection("users").doc(currentUser.id).update({
    preferred_mode: type,
    last_updated: firebase.firestore.FieldValue.serverTimestamp()
  }).then(() => alert(`Meal preference updated to: ${type}`));
}

function setTimeSlot(slot) {
  if(!currentUser) return;
  db.collection("users").doc(currentUser.id).update({
    time_slot: slot
  });
}

function submitAbsence() {
  const from = document.getElementById("absentDateFrom").value;
  const to = document.getElementById("absentDateTo").value;

  if(!from || !to) {
    alert("Please select both dates.");
    return;
  }

  db.collection("users").doc(currentUser.id).update({
    is_absent: true,
    absent_from: from,
    absent_to: to
  }).then(() => alert("Leave request submitted successfully!"));
}

/* --- MARATHI ADMIN LOGIC --- */
function handleAdminLogin(e) {
  e.preventDefault();
  const pass = document.getElementById("adminPassInput").value;
  if(pass === "admin123") { // Change your secret admin password here
    localStorage.setItem("mess_role", "admin");
    showScreen("adminDashboard");
    loadAdminDashboard();
  } else {
    alert("चुकीचा पासवर्ड! (Wrong Password)");
  }
}

function loadAdminDashboard() {
  db.collection("users").onSnapshot(snapshot => {
    let total = snapshot.size;
    let absent = 0;
    let dineIn = 0;
    let tiffin = 0;

    const listContainer = document.getElementById("adminStudentList");
    listContainer.innerHTML = "";

    snapshot.forEach(doc => {
      const d = doc.data();
      const sId = doc.id;

      if(d.is_absent) absent++;
      if(d.preferred_mode === "Tiffin") tiffin++;
      else dineIn++;

      const isPaid = (d.due_amount <= 0);
      const card = document.createElement("div");
      card.className = "bg-slate-900 p-3 rounded-xl border border-slate-800 flex justify-between items-center text-xs";
      card.innerHTML = `
        <div>
          <p class="font-bold text-white">${d.name || 'No Name'} <span class="${isPaid ? 'text-emerald-400' : 'text-red-400'}">(${isPaid ? 'Paid' : 'Unpaid'})</span></p>
          <p class="text-slate-500">📞 ${d.phone} | Due: ₹${d.due_amount || 0}</p>
        </div>
        <div class="flex gap-1">
          <button onclick="clearDuesAdmin('${sId}')" class="bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 px-2 py-1 rounded">Clear</button>
          <button onclick="deleteStudentAdmin('${sId}')" class="bg-red-600/30 text-red-300 border border-red-500/40 px-2 py-1 rounded">✕</button>
        </div>
      `;
      listContainer.appendChild(card);
    });

    document.getElementById("cntTotal").innerText = total;
    document.getElementById("cntAbsent").innerText = absent;
    document.getElementById("cntToCook").innerText = Math.max(0, total - absent);
    document.getElementById("cntDineIn").innerText = dineIn;
    document.getElementById("cntTiffin").innerText = tiffin;
  });
}

function addStudentAdmin(e) {
  e.preventDefault();
  const name = document.getElementById("aName").value;
  const phone = document.getElementById("aPhone").value;
  const total = parseFloat(document.getElementById("aTotalFee").value);
  const paid = parseFloat(document.getElementById("aPaidFee").value);
  const date = document.getElementById("aJoiningDate").value;

  const due = total - paid;

  db.collection("users").doc(phone).set({
    name: name,
    phone: phone,
    total_fee: total,
    paid_amount: paid,
    due_amount: due,
    fees_paid: due <= 0,
    payment_date: date,
    preferred_mode: "Dine-In",
    is_absent: false
  }).then(() => {
    alert("विद्यार्थी यशस्वीरित्या जोडला गेला!");
    document.getElementById("addStudentFormAdmin").reset();
  });
}

function clearDuesAdmin(id) {
  if(confirm("या विद्यार्थ्याची फी पूर्ण जमा झाली आहे का?")) {
    db.collection("users").doc(id).update({
      paid_amount: 2200,
      due_amount: 0,
      fees_paid: true
    });
  }
}

function deleteStudentAdmin(id) {
  if(confirm("या विद्यार्थ्याचे नाव काढून टाकायचे का?")) {
    db.collection("users").doc(id).delete();
  }
}

function publishNotice() {
  const txt = document.getElementById("adminNoticeInput").value;
  if(!txt) return;
  document.getElementById("globalNoticeBar").classList.remove("hidden");
  document.getElementById("noticeText").innerText = "📢 " + txt;
}

function shareWhatsAppGroup() {
  const txt = document.getElementById("adminNoticeInput").value || "महत्वाची सूचना: मेस चालू राहील.";
  window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, '_blank');
}

function closeNotice() {
  document.getElementById("globalNoticeBar").classList.add("hidden");
}

function logout() {
  localStorage.clear();
  showScreen("roleSelectionScreen");
}

