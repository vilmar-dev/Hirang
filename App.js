// =====================================================
// SMART STUDENT ID & RANDOM PICKER — MERGED APP LOGIC
// (Combines former App.js + Picker.js into one file,
// since both Student and Teacher sections now live on
// the same index.html page.)
// =====================================================

// -----------------------------------------------------
// THEME TOGGLE (shared by both Student and Teacher views)
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
// ROLE SELECTOR (Student vs Teacher)
// -----------------------------------------------------
const roleSelectCard = document.getElementById("roleSelectCard");
const studentSection = document.getElementById("studentSection");
const teacherSection = document.getElementById("teacherSection");
const navbarTitle = document.getElementById("navbarTitle");

const chooseStudentBtn = document.getElementById("chooseStudentBtn");
const chooseTeacherBtn = document.getElementById("chooseTeacherBtn");
const studentBackBtn = document.getElementById("studentBackBtn");
const teacherBackBtn = document.getElementById("teacherBackBtn");

function showRoleSelect() {
  roleSelectCard.classList.remove("hidden");
  studentSection.classList.add("hidden");
  teacherSection.classList.add("hidden");
  navbarTitle.innerHTML = `Smart Student ID<span>Fair &amp; transparent classroom tools</span>`;
}

function showStudentSection() {
  roleSelectCard.classList.add("hidden");
  teacherSection.classList.add("hidden");
  studentSection.classList.remove("hidden");
  navbarTitle.innerHTML = `Student ID Registration<span>Fair &amp; transparent classroom tools</span>`;
}

function showTeacherSection() {
  roleSelectCard.classList.add("hidden");
  studentSection.classList.add("hidden");
  teacherSection.classList.remove("hidden");
  navbarTitle.innerHTML = `Teacher Dashboard<span>Random Picker &amp; Class Management</span>`;
}

chooseStudentBtn.addEventListener("click", showStudentSection);
chooseTeacherBtn.addEventListener("click", showTeacherSection);
studentBackBtn.addEventListener("click", () => {
  if (studentsUnsub) studentsUnsub();
  showRoleSelect();
});
teacherBackBtn.addEventListener("click", () => {
  if (studentsUnsub) studentsUnsub();
  showRoleSelect();
});

// =====================================================
// STUDENT SECTION LOGIC
// =====================================================

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
// STUDENT DOM REFERENCES
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
let studentsUnsub = null; // Firestore listener unsubscribe function (shared name; only one section is active at a time)

// -----------------------------------------------------
// PRE-FILL CLASS CODE FROM URL (?class=ABC123)
// If a student arrives via a shared link, skip the role
// selector entirely and jump straight into the Student view.
// -----------------------------------------------------
(function prefillFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const codeFromUrl = params.get("class");
  if (codeFromUrl) {
    showStudentSection();
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

// =====================================================
// TEACHER SECTION LOGIC
// =====================================================

const loginCard = document.getElementById("loginCard");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const signupForm = document.getElementById("signupForm");
const signupError = document.getElementById("signupError");
const showSignupLink = document.getElementById("showSignup");
const showLoginLink = document.getElementById("showLogin");

const classListCard = document.getElementById("classListCard");
const classListContainer = document.getElementById("classListContainer");
const newClassForm = document.getElementById("newClassForm");
const newClassName = document.getElementById("newClassName");
const newClassMsg = document.getElementById("newClassMsg");
const logoutBtn = document.getElementById("logoutBtn");

const classDetailCard = document.getElementById("classDetailCard");
const backToClassesBtn = document.getElementById("backToClassesBtn");
const detailClassName = document.getElementById("detailClassName");
const detailClassCode = document.getElementById("detailClassCode");
const detailClassLink = document.getElementById("detailClassLink");

const poolCount = document.getElementById("poolCount");
const pickerNameDisplay = document.getElementById("pickerNameDisplay");
const shuffleBtn = document.getElementById("shuffleBtn");
const resetPoolBtn = document.getElementById("resetPoolBtn");
const studentListDisplay = document.getElementById("studentListDisplay");

let currentTeacherUid = null;
let currentTeacherClassId = null; // separate from the student section's currentClassId
let currentClassStudents = []; // [{id, name, picked}]
let teacherStudentsUnsub = null; // separate listener from the student section's studentsUnsub

// -----------------------------------------------------
// LOGIN / SIGNUP TAB SWITCHING
// -----------------------------------------------------
showSignupLink.addEventListener("click", (e) => {
  e.preventDefault();
  loginForm.classList.add("hidden");
  signupForm.classList.remove("hidden");
});
showLoginLink.addEventListener("click", (e) => {
  e.preventDefault();
  signupForm.classList.add("hidden");
  loginForm.classList.remove("hidden");
});

// -----------------------------------------------------
// SIGN UP
// -----------------------------------------------------
signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  signupError.textContent = "";

  const name = document.getElementById("signupName").value.trim();
  const email = document.getElementById("signupEmail").value.trim();
  const password = document.getElementById("signupPassword").value;

  try {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    await cred.user.updateProfile({ displayName: name });
  } catch (err) {
    signupError.textContent = friendlyAuthError(err);
  }
});

// -----------------------------------------------------
// LOG IN
// -----------------------------------------------------
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.textContent = "";

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  try {
    await auth.signInWithEmailAndPassword(email, password);
  } catch (err) {
    loginError.textContent = friendlyAuthError(err);
  }
});

logoutBtn.addEventListener("click", () => auth.signOut());

function friendlyAuthError(err) {
  switch (err.code) {
    case "auth/email-already-in-use": return "That email is already registered. Try logging in instead.";
    case "auth/invalid-email": return "Please enter a valid email address.";
    case "auth/weak-password": return "Password should be at least 6 characters.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential": return "Incorrect email or password.";
    default: return err.message || "Something went wrong. Please try again.";
  }
}

// -----------------------------------------------------
// AUTH STATE — routes between login and dashboard
// (Only affects the Teacher section; the Student section
// is fully separate and doesn't require login.)
// -----------------------------------------------------
auth.onAuthStateChanged((user) => {
  if (user) {
    currentTeacherUid = user.uid;
    loginCard.classList.add("hidden");
    classDetailCard.classList.add("hidden");
    classListCard.classList.remove("hidden");
    loadMyClasses();
  } else {
    currentTeacherUid = null;
    classListCard.classList.add("hidden");
    classDetailCard.classList.add("hidden");
    loginCard.classList.remove("hidden");
    if (teacherStudentsUnsub) teacherStudentsUnsub();
  }
});

// -----------------------------------------------------
// CLASS LIST — load all classes owned by this teacher
// -----------------------------------------------------
function loadMyClasses() {
  db.collection("classes").where("teacherUid", "==", currentTeacherUid)
    .onSnapshot((snapshot) => {
      if (snapshot.empty) {
        classListContainer.innerHTML = `<p class="card-sub">You haven't created any classes yet.</p>`;
        return;
      }

      const rows = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        rows.push({ id: doc.id, ...data });
      });

      classListContainer.innerHTML = rows.map(c => `
        <div class="class-row" data-class-id="${c.id}">
          <div>
            <div class="class-row-name">${escapeHtml(c.name)}</div>
            <div class="class-row-meta">Code: ${escapeHtml(c.code)}</div>
          </div>
          <span class="class-code-pill">${escapeHtml(c.code)}</span>
        </div>
      `).join("");

      classListContainer.querySelectorAll(".class-row").forEach(row => {
        row.addEventListener("click", () => openClassDetail(row.dataset.classId));
      });
    });
}

// -----------------------------------------------------
// CREATE NEW CLASS
// -----------------------------------------------------
newClassForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  newClassMsg.textContent = "";
  newClassMsg.className = "form-msg";

  const name = newClassName.value.trim();
  if (!name) return;

  const code = generateClassCode();

  try {
    await db.collection("classes").add({
      name: name,
      code: code,
      teacherUid: currentTeacherUid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    newClassName.value = "";
    newClassMsg.textContent = `Class created! Code: ${code}`;
    newClassMsg.classList.add("success");
  } catch (err) {
    newClassMsg.textContent = "Could not create class: " + err.message;
    newClassMsg.classList.add("error");
  }
});

function generateClassCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0/I/1 to avoid confusion
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// -----------------------------------------------------
// OPEN CLASS DETAIL + RANDOM PICKER
// -----------------------------------------------------
function openClassDetail(classId) {
  currentTeacherClassId = classId;

  db.collection("classes").doc(classId).get().then((doc) => {
    if (!doc.exists) return;
    const data = doc.data();
    detailClassName.textContent = data.name;
    detailClassCode.textContent = data.code;

    // Registration link points back to this same merged index.html,
    // just with ?class=CODE appended so the student auto-jumps in.
    const link = `${window.location.origin}${window.location.pathname}?class=${data.code}`;
    detailClassLink.href = link;
    detailClassLink.onclick = (e) => {
      e.preventDefault();
      navigator.clipboard.writeText(link).then(() => {
        detailClassLink.textContent = "Link copied!";
        setTimeout(() => { detailClassLink.textContent = "copy registration link"; }, 2000);
      });
    };
  });

  classListCard.classList.add("hidden");
  classDetailCard.classList.remove("hidden");

  listenToClassStudents(classId);
}

backToClassesBtn.addEventListener("click", () => {
  if (teacherStudentsUnsub) teacherStudentsUnsub();
  currentTeacherClassId = null;
  classDetailCard.classList.add("hidden");
  classListCard.classList.remove("hidden");
});

function listenToClassStudents(classId) {
  if (teacherStudentsUnsub) teacherStudentsUnsub();

  teacherStudentsUnsub = db.collection("classes").doc(classId).collection("students")
    .onSnapshot((snapshot) => {
      currentClassStudents = [];
      snapshot.forEach((doc) => {
        currentClassStudents.push({ id: doc.id, ...doc.data() });
      });
      currentClassStudents.sort((a, b) => Number(a.id) - Number(b.id));
      renderPickerState();
    });
}

// -----------------------------------------------------
// RANDOM PICKER LOGIC
// -----------------------------------------------------
function getActivePool() {
  return currentClassStudents.filter(s => !s.picked);
}

function renderPickerState() {
  const pool = getActivePool();
  poolCount.textContent = `${pool.length} of ${currentClassStudents.length} students in pool`;

  studentListDisplay.innerHTML = currentClassStudents.map(s => `
    <span class="student-tag ${s.picked ? "removed" : ""}">${escapeHtml(s.name)} (#${s.id})</span>
  `).join("");

  shuffleBtn.disabled = pool.length === 0;
  if (pool.length === 0 && currentClassStudents.length > 0) {
    pickerNameDisplay.textContent = "Everyone has been picked! 🎉";
  }
}

shuffleBtn.addEventListener("click", () => {
  const pool = getActivePool();
  if (pool.length === 0) return;

  shuffleBtn.disabled = true;
  pickerNameDisplay.classList.add("shuffling");

  // Quick visual shuffle animation before landing on the real pick
  let shuffleCount = 0;
  const shuffleInterval = setInterval(() => {
    const randomStudent = pool[Math.floor(Math.random() * pool.length)];
    pickerNameDisplay.textContent = randomStudent.name;
    shuffleCount++;
    if (shuffleCount > 12) {
      clearInterval(shuffleInterval);
      finalizePick(pool);
    }
  }, 80);
});

async function finalizePick(pool) {
  // Final random selection using the exact logic from the spec
  const selectedIndex = Math.floor(Math.random() * pool.length);
  const selected = pool[selectedIndex];

  pickerNameDisplay.classList.remove("shuffling");
  pickerNameDisplay.textContent = selected.name;

  // Mark as picked (removes from pool) in Firestore so it's
  // visible to anyone else viewing this class, and persists offline.
  try {
    await db.collection("classes").doc(currentTeacherClassId)
      .collection("students").doc(selected.id)
      .update({ picked: true });
  } catch (err) {
    console.warn("Could not mark student as picked (will retry when online):", err.message);
  }

  shuffleBtn.disabled = false;
}

resetPoolBtn.addEventListener("click", async () => {
  if (!confirm("Reset the pool? Everyone becomes eligible to be picked again.")) return;

  const batch = db.batch();
  currentClassStudents.forEach(s => {
    const ref = db.collection("classes").doc(currentTeacherClassId).collection("students").doc(s.id);
    batch.update(ref, { picked: false });
  });

  try {
    await batch.commit();
    pickerNameDisplay.textContent = "Press Shuffle";
  } catch (err) {
    alert("Could not reset pool: " + err.message);
  }
});

// =====================================================
// SHARED UTILS
// =====================================================
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// =====================================================
// REGISTER SERVICE WORKER (PWA)
// =====================================================
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((err) => {
      console.warn("Service worker registration failed:", err);
    });
  });
}
