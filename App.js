// =====================================================
// STUDENT ID REGISTRATION — APP LOGIC
// =====================================================

// -----------------------------------------------------
// THEME TOGGLE (shared pattern with picker.js)
// -----------------------------------------------------
const themeToggle = document.getElementById("themeToggle");

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  themeToggle.textContent = theme === "dark" ? "☀️ Light" : "🌙 Dark";
  localStorage.setItem("theme", theme);
}

(function initTheme() {
  const saved = localStorage.getItem("theme") || "light";
  applyTheme(saved);
})();

themeToggle.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  applyTheme(current === "dark" ? "light" : "dark");
});

// -----------------------------------------------------
// ONLINE / OFFLINE STATUS BANNER
// -----------------------------------------------------
const statusBanner = document.getElementById("statusBanner");
const statusText = document.getElementById("statusText");

function updateOnlineStatus() {
  if (navigator.onLine) {
    statusBanner.classList.remove("offline");
    statusBanner.classList.add("online");
    statusText.textContent = "Online — changes sync instantly";
  } else {
    statusBanner.classList.remove("online");
    statusBanner.classList.add("offline");
    statusText.textContent = "Offline — your registration will be saved and synced once you're back online";
  }
}
window.addEventListener("online", updateOnlineStatus);
window.addEventListener("offline", updateOnlineStatus);
updateOnlineStatus();

// -----------------------------------------------------
// DOM REFERENCES
// -----------------------------------------------------
const classCodeCard = document.getElementById("classCodeCard");
const classCodeInput = document.getElementById("classCodeInput");
const findClassBtn = document.getElementById("findClassBtn");
const classCodeMsg = document.getElementById("classCodeMsg");

const registerCard = document.getElementById("registerCard");
const className = document.getElementById("className");
const idInput = document.getElementById("idInput");
const nameInput = document.getElementById("nameInput");
const registerBtn = document.getElementById("registerBtn");
const registerMsg = document.getElementById("registerMsg");
const backToCodeBtn = document.getElementById("backToCodeBtn");

const idOverviewCard = document.getElementById("idOverviewCard");
const idOverviewSub = document.getElementById("idOverviewSub");
const idGrid = document.getElementById("idGrid");

let currentClassId = null;
let studentsUnsub = null; // Firestore listener unsubscribe function

// -----------------------------------------------------
// PRE-FILL CLASS CODE FROM URL (?class=ABC123)
// -----------------------------------------------------
(function prefillFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const codeFromUrl = params.get("class");
  if (codeFromUrl) {
    classCodeInput.value = codeFromUrl.toUpperCase();
    findClass(); // auto-search if a link was used
  }
})();

// -----------------------------------------------------
// FIND CLASS BY CODE
// -----------------------------------------------------
findClassBtn.addEventListener("click", findClass);
classCodeInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") findClass();
});

async function findClass() {
  const code = classCodeInput.value.trim().toUpperCase();
  classCodeMsg.textContent = "";
  classCodeMsg.className = "form-msg";

  if (!code) {
    classCodeMsg.textContent = "Please enter a class code.";
    classCodeMsg.classList.add("error");
    return;
  }

  findClassBtn.disabled = true;
  findClassBtn.textContent = "Searching…";

  try {
    const snap = await db.collection("classes").where("code", "==", code).limit(1).get();

    if (snap.empty) {
      classCodeMsg.textContent = "No class found with that code. Double-check with your teacher.";
      classCodeMsg.classList.add("error");
      return;
    }

    const classDoc = snap.docs[0];
    currentClassId = classDoc.id;
    className.textContent = classDoc.data().name || "Class";

    classCodeCard.classList.add("hidden");
    registerCard.classList.remove("hidden");
    idOverviewCard.classList.remove("hidden");

    listenToStudents(currentClassId);
  } catch (err) {
    classCodeMsg.textContent = "Could not search right now. " + (navigator.onLine ? err.message : "You appear to be offline — try again once connected.");
    classCodeMsg.classList.add("error");
  } finally {
    findClassBtn.disabled = false;
    findClassBtn.textContent = "Find Class";
  }
}

backToCodeBtn.addEventListener("click", () => {
  if (studentsUnsub) studentsUnsub();
  currentClassId = null;
  registerCard.classList.add("hidden");
  idOverviewCard.classList.add("hidden");
  classCodeCard.classList.remove("hidden");
  classCodeInput.value = "";
  classCodeMsg.textContent = "";
  idInput.value = "";
  nameInput.value = "";
  registerMsg.textContent = "";
});

// -----------------------------------------------------
// LIVE STUDENT LIST FOR THE SELECTED CLASS
// (powers the "Registered IDs" overview grid)
// -----------------------------------------------------
function listenToStudents(classId) {
  if (studentsUnsub) studentsUnsub();

  studentsUnsub = db.collection("classes").doc(classId).collection("students")
    .onSnapshot((snapshot) => {
      const takenIds = new Set();
      snapshot.forEach((doc) => takenIds.add(Number(doc.id)));
      renderIdGrid(takenIds);
    }, (err) => {
      console.warn("Student listener error (likely offline, will retry automatically):", err.message);
    });
}

function renderIdGrid(takenIds) {
  idOverviewSub.textContent = `${takenIds.size} of 45 students registered`;
  let html = "";
  for (let i = 1; i <= 45; i++) {
    const taken = takenIds.has(i);
    html += `<div class="id-chip ${taken ? "taken" : ""}">${i}</div>`;
  }
  idGrid.innerHTML = html;
}

// -----------------------------------------------------
// REGISTER STUDENT
// -----------------------------------------------------
registerBtn.addEventListener("click", async () => {
  registerMsg.textContent = "";
  registerMsg.className = "form-msg";

  const id = parseInt(idInput.value, 10);
  const name = nameInput.value.trim();

  if (!currentClassId) {
    registerMsg.textContent = "Please find your class first.";
    registerMsg.classList.add("error");
    return;
  }

  if (!id || id < 1 || id > 45) {
    registerMsg.textContent = "ID must be a number between 1 and 45.";
    registerMsg.classList.add("error");
    return;
  }

  if (!name) {
    registerMsg.textContent = "Please enter your full name.";
    registerMsg.classList.add("error");
    return;
  }

  registerBtn.disabled = true;
  registerBtn.textContent = "Registering…";

  try {
    const studentRef = db.collection("classes").doc(currentClassId).collection("students").doc(String(id));

    // Use a transaction so two students racing for the same ID
    // (e.g. both online at once) can't both succeed.
    await db.runTransaction(async (tx) => {
      const existing = await tx.get(studentRef);
      if (existing.exists) {
        throw new Error("ID_TAKEN");
      }
      tx.set(studentRef, {
        name: name,
        registeredAt: firebase.firestore.FieldValue.serverTimestamp(),
        picked: false
      });
    });

    registerMsg.textContent = `Registered! Welcome, ${name} (ID ${id}).`;
    registerMsg.classList.add("success");
    idInput.value = "";
    nameInput.value = "";
  } catch (err) {
    if (err.message === "ID_TAKEN") {
      registerMsg.textContent = "ID already taken. Please choose a different number.";
    } else if (!navigator.onLine) {
      registerMsg.textContent = "You're offline — registration saved locally and will sync once you're back online.";
      registerMsg.classList.add("success");
      idInput.value = "";
      nameInput.value = "";
    } else {
      registerMsg.textContent = "Could not register: " + err.message;
    }
    if (registerMsg.textContent.includes("taken") || (err.message !== "ID_TAKEN" && navigator.onLine)) {
      registerMsg.classList.add("error");
    }
  } finally {
    registerBtn.disabled = false;
    registerBtn.textContent = "Register";
  }
});

// -----------------------------------------------------
// REGISTER SERVICE WORKER (PWA)
// -----------------------------------------------------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((err) => {
      console.warn("Service worker registration failed:", err);
    });
  });
}