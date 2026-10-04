/* =========================================================
   Owner Dashboard Logic - Royal Mess
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  // 1. Form submit hone par naya student add karo
  document.getElementById("addStudentForm").addEventListener("submit", addStudent);
  
  // 2. Database se saare students ki list laao
  fetchStudentsLive();
});

// Naya Student Add Karne Ka Function
function addStudent(e) {
  e.preventDefault(); // Page refresh rokne ke liye

  const name = document.getElementById("sName").value;
  const phone = document.getElementById("sPhone").value;
  const totalFee = parseFloat(document.getElementById("sTotalFee").value);
  const paidAmount = parseFloat(document.getElementById("sPaidAmount").value);
  
  const dueAmount = totalFee - paidAmount;
  const feesPaid = dueAmount <= 0; // Agar due 0 ya negative hai, toh Paid
  
  const todayDate = new Date().toISOString().split('T')[0];
  const studentId = phone; // Mobile number ko hi Unique ID bana rahe hain

  const studentData = {
    name: name,
    phone: phone,
    total_fee: totalFee,
    paid_amount: paidAmount,
    due_amount: dueAmount,
    fees_paid: feesPaid,
    payment_date: todayDate,
    joined_date: firebase.firestore.FieldValue.serverTimestamp()
  };

  // Firebase me save karo
  db.collection("users").doc(studentId).set(studentData)
  .then(() => {
    alert("✅ Student Added Successfully!\nInka QR Code ID hai: " + phone);
    document.getElementById("addStudentForm").reset(); // Form clear karo
  })
  .catch(err => {
    alert("Error saving student: " + err.message);
  });
}

// Live Student List Fetch Karne Ka Function
function fetchStudentsLive() {
  const studentListContainer = document.getElementById("studentList");

  // onSnapshot ka matlab hai jaise hi database update hoga, screen apne aap update hogi
  db.collection("users").orderBy("name").onSnapshot(snapshot => {
    studentListContainer.innerHTML = ""; // Purani list clear karo

    if (snapshot.empty) {
      studentListContainer.innerHTML = "<p class='text-slate-400 text-sm text-center py-4'>No students found.</p>";
      return;
    }

    snapshot.forEach(doc => {
      const data = doc.data();
      const sId = doc.id;
      
      // Card Design generate karo
      const card = document.createElement("div");
      card.className = "bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-sm flex flex-col gap-3";
      
      // Badge logic (Paid ya Unpaid)
      const badgeHTML = data.fees_paid 
        ? `<span class="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border border-emerald-500/50">Paid</span>`
        : `<span class="bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border border-red-500/50">Unpaid</span>`;

      card.innerHTML = `
        <div class="flex justify-between items-start">
          <div>
            <h3 class="text-base font-bold text-white flex items-center gap-2">${data.name || 'No Name'} ${badgeHTML}</h3>
            <p class="text-xs text-slate-400 font-medium">📞 ${data.phone || sId}</p>
          </div>
          <div class="text-right">
            <p class="text-xs text-slate-400">Due Amount</p>
            <p class="text-lg font-black ${data.due_amount > 0 ? 'text-red-400' : 'text-emerald-400'}">₹${data.due_amount || 0}</p>
          </div>
        </div>
        
        <div class="bg-slate-900 rounded-xl p-3 flex justify-between items-center mt-1 border border-slate-700/50">
          <div>
            <p class="text-[10px] text-slate-500 uppercase font-bold">Total: ₹${data.total_fee || 0}</p>
            <p class="text-[10px] text-slate-500 uppercase font-bold">Paid: ₹${data.paid_amount || 0}</p>
          </div>
          <button onclick="markAsPaid('${sId}')" class="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95 transition-all">
            Clear Dues
          </button>
        </div>
      `;

      studentListContainer.appendChild(card);
    });
  });
}

// Outstanding Due Clear Karne Ka Function
function markAsPaid(studentId) {
  const confirmPayment = confirm("Aap is student ka baaki ka paisa (Due) clear kar rahe hain. Confirm?");
  
  if (confirmPayment) {
    db.collection("users").doc(studentId).get().then(doc => {
      const data = doc.data();
      const todayDate = new Date().toISOString().split('T')[0];
      
      // Update data: Paid amount ko total ke barabar kar do, aur due 0 kar do
      db.collection("users").doc(studentId).update({
        paid_amount: data.total_fee,
        due_amount: 0,
        fees_paid: true,
        payment_date: todayDate
      }).then(() => {
        // alert("Payment updated!"); // onSnapshot apne aap UI update kar dega
      }).catch(err => alert("Update fail: " + err.message));
    });
  }
}
