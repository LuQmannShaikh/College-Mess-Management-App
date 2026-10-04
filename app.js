let currentUser = null;

document.addEventListener("DOMContentLoaded", () => {
  const today = new Date().toISOString().split('T')[0];
  if(document.getElementById("aJoiningDate")) document.getElementById("aJoiningDate").value = today;

  document.getElementById("studentLoginForm")?.addEventListener("submit", handleStudentLogin);
  document.getElementById("adminLoginForm")?.addEventListener("submit", handleAdminLogin);
  document.getElementById("addStudentFormAdmin")?.addEventListener("submit", addStudentAdmin);

  const savedRole = localStorage.getItem("mess_role");
  const savedPhone = localStorage.getItem("mess_phone");

  if (savedRole === "admin") { showScreen("adminDashboard"); loadAdminDashboard(); } 
  else if (savedRole === "student" && savedPhone) { loginStudentByPhone(savedPhone); }
});

function showScreen(screenId) {
  const screens = ["roleSelectionScreen", "studentLoginScreen", "adminLoginScreen", "studentDashboard", "adminDashboard"];
  screens.forEach(id => { const el = document.getElementById(id); if(el) el.classList.add("hidden"); });
  document.getElementById(screenId)?.classList.remove("hidden");
}

/* --- STUDENT LOGIC --- */
function handleStudentLogin(e) {
  e.preventDefault();
  const phone = document.getElementById("studentPhoneInput").value.trim();
  const pin = document.getElementById("studentPinInput").value.trim();
  if(!phone || !pin) return;

  db.collection("users").doc(phone).get().then(doc => {
    if(doc.exists && (doc.data().pin === pin || doc.data().pin === undefined)) {
      currentUser = { id: doc.id, ...doc.data() };
      localStorage.setItem("mess_role", "student");
      localStorage.setItem("mess_phone", phone);
      setupStudentDashboard();
      showScreen("studentDashboard");
    } else { alert("गलत PIN किंवा नंबर!"); }
  }).catch(err => alert("Error: " + err.message));
}

function loginStudentByPhone(phone) {
  db.collection("users").doc(phone).get().then(doc => {
    if(doc.exists) { currentUser = { id: doc.id, ...doc.data() }; setupStudentDashboard(); showScreen("studentDashboard"); }
  });
}

function setupStudentDashboard() {
  document.getElementById("sNameDisplay").innerText = currentUser.name || "Student";
  document.getElementById("sCycleDisplay").innerText = `Month Starts: ${currentUser.payment_date || 'N/A'}`;

  const passCard = document.getElementById("visualPassCard");
  const icon = document.getElementById("passBadgeIcon");
  const title = document.getElementById("passTitle");
  const subText = document.getElementById("passSubText");

  // Admin controls leave cancellation now
  if(currentUser.is_absent) {
    passCard.className = "bg-red-500/10 border-2 border-red-500 p-5 rounded-2xl text-center space-y-2";
    icon.innerText = "🛑"; title.innerText = "MEAL BLOCKED (ON LEAVE)"; title.className = "text-lg font-black text-red-400";
    subText.innerText = `Absent from ${currentUser.absent_from} to ${currentUser.absent_to}`;
    document.getElementById("studentAbsenceBox").classList.add("hidden");
    document.getElementById("leaveActiveMsg").classList.remove("hidden");
  } else {
    passCard.className = "bg-emerald-500/10 border-2 border-emerald-500 p-5 rounded-2xl text-center space-y-2";
    icon.innerText = "✅"; title.innerText = `MEAL PASS VALID (${currentUser.preferred_mode || 'Dine-In'})`; title.className = "text-lg font-black text-emerald-400";
    subText.innerText = "Show this screen at counter";
    document.getElementById("studentAbsenceBox").classList.remove("hidden");
    document.getElementById("leaveActiveMsg").classList.add("hidden");
  }

  // Fee Alert logic
  const due = (currentUser.total_fee || 2200) - (currentUser.paid_amount || 0);
  if (due > 0) {
    const diffDays = Math.floor((new Date() - new Date(currentUser.payment_date)) / (1000 * 60 * 60 * 24));
    if (diffDays >= (currentUser.paid_amount >= (currentUser.total_fee/2) ? 15 : 8)) {
      document.getElementById("feeAlertBanner").classList.remove("hidden");
      document.getElementById("feeAlertText").innerText = `Your pending fee is ₹${due}. Please pay soon.`;
    }
  }
}

function setMealType(type) {
  if(!currentUser) return;
  db.collection("users").doc(currentUser.id).update({ preferred_mode: type }).then(() => {
    currentUser.preferred_mode = type; setupStudentDashboard(); alert(`Updated to: ${type}`);
  });
}

function submitAbsence() {
  const from = document.getElementById("absentDateFrom").value;
  const to = document.getElementById("absentDateTo").value;
  if(!from || !to) { alert("Select both dates."); return; }
  
  db.collection("users").doc(currentUser.id).update({
    is_absent: true, absent_from: from, absent_to: to,
    leave_history: firebase.firestore.FieldValue.arrayUnion({from: from, to: to})
  }).then(() => {
    currentUser.is_absent = true; currentUser.absent_from = from; currentUser.absent_to = to;
    setupStudentDashboard(); alert("Leave marked successfully!");
  });
}

/* --- ADMIN LOGIC --- */
function handleAdminLogin(e) {
  e.preventDefault();
  if(document.getElementById("adminPassInput").value === "admin123") {
    localStorage.setItem("mess_role", "admin"); showScreen("adminDashboard"); loadAdminDashboard();
  } else { alert("चुकीचा पासवर्ड!"); }
}

function loadAdminDashboard() {
  db.collection("users").onSnapshot(snapshot => {
    let total = snapshot.size, absent = 0;
    const unpaidList = document.getElementById("unpaidStudentList");
    const paidList = document.getElementById("paidStudentList");
    const absentList = document.getElementById("absentStudentsDetailList");

    unpaidList.innerHTML = ""; paidList.innerHTML = ""; absentList.innerHTML = "";

    snapshot.forEach(doc => {
      const d = doc.data(); const sId = doc.id;
      
      // Absent Logic & Admin Cancel Leave Button
      if(d.is_absent) {
        absent++;
        absentList.innerHTML += `
          <div class="flex justify-between items-center bg-red-950/40 p-2 rounded-lg border border-red-500/20">
            <div><b>${d.name}</b> <span class="text-[10px]">(${d.absent_from} ते ${d.absent_to})</span></div>
            <button onclick="cancelLeaveAdmin('${sId}')" class="bg-emerald-600/80 text-white px-2 py-1 rounded text-[10px]">सुट्टी रद्द करा</button>
          </div>`;
      }

      // Paid / Unpaid Segregation & WhatsApp Reminder
      const due = (d.total_fee || 0) - (d.paid_amount || 0);
      const whatsappMsg = encodeURIComponent(`Hello ${d.name}, a gentle reminder that your mess fee of ₹${due} is pending. Please clear it at the earliest to ensure uninterrupted services. Thank you!`);
      
      const cardHTML = `
        <div class="bg-slate-900 p-3 rounded-xl border border-slate-800 flex flex-col gap-2 text-xs">
          <div class="flex justify-between items-center">
            <p class="font-bold text-white">${d.name} <span class="text-slate-400">(${d.phone})</span></p>
            ${due > 0 ? `<p class="font-bold text-red-400">Due: ₹${due}</p>` : `<p class="font-bold text-emerald-400">No Dues</p>`}
          </div>
          <div class="flex justify-between items-center mt-1">
            <div class="flex gap-2">
              ${due > 0 ? `
                <a href="tel:${d.phone}" class="bg-blue-600/30 text-blue-300 border border-blue-500/40 px-2 py-1 rounded">📞 Call</a>
                <a href="https://wa.me/91${d.phone}?text=${whatsappMsg}" target="_blank" class="bg-green-600/30 text-green-300 border border-green-500/40 px-2 py-1 rounded">💬 WhatsApp</a>
              ` : ''}
            </div>
            <div class="flex gap-1">
              ${due > 0 ? `<button onclick="clearDuesAdmin('${sId}')" class="bg-indigo-600/30 text-indigo-300 px-2 py-1 rounded border border-indigo-500/40">Mark Paid</button>` : ''}
              <button onclick="deleteStudentAdmin('${sId}')" class="bg-red-600/30 text-red-300 px-2 py-1 rounded border border-red-500/40">✕</button>
            </div>
          </div>
        </div>`;

      if(due > 0) unpaidList.innerHTML += cardHTML;
      else paidList.innerHTML += cardHTML;
    });

    if(absent === 0) absentList.innerHTML = "कोणीही गैरहजर नाही.";
    document.getElementById("cntTotal").innerText = total;
    document.getElementById("cntAbsent").innerText = absent;
    document.getElementById("cntToCook").innerText = Math.max(0, total - absent);
  });
}

function cancelLeaveAdmin(id) {
  if(confirm("या विद्यार्थ्याची सुट्टी रद्द करायची का? (Meal pass will be active again)")) {
    db.collection("users").doc(id).update({ is_absent: false });
  }
}

function addStudentAdmin(e) {
  e.preventDefault();
  const phone = document.getElementById("aPhone").value;
  db.collection("users").doc(phone).set({
    name: document.getElementById("aName").value,
    phone: phone, pin: document.getElementById("aPin").value || "1234",
    total_fee: parseFloat(document.getElementById("aTotalFee").value),
    paid_amount: parseFloat(document.getElementById("aPaidFee").value),
    payment_date: document.getElementById("aJoiningDate").value,
    preferred_mode: "Dine-In", is_absent: false
  }).then(() => { alert("नोंदणी झाली!"); document.getElementById("addStudentFormAdmin").reset(); });
}

function clearDuesAdmin(id) {
  if(confirm("फी पूर्ण जमा झाली?")) {
    db.collection("users").doc(id).get().then(doc => {
      db.collection("users").doc(id).update({ paid_amount: doc.data().total_fee });
    });
  }
}

function deleteStudentAdmin(id) { if(confirm("नाव काढायचे?")) db.collection("users").doc(id).delete(); }
function logout() { localStorage.clear(); showScreen("roleSelectionScreen"); }
function closeNotice() { document.getElementById("globalNoticeBar").classList.add("hidden"); }
