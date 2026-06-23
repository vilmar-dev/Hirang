// =====================================================
// TEACHER DASHBOARD & RANDOM PICKER — APP LOGIC
// =====================================================

// -----------------------------------------------------
// THEME TOGGLE (same pattern as app.js, kept independent
// since this is a separate HTML page/script context)
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
// DOM REFERENCES
// -----------------------------------------------------
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
let currentClassId = null;
let currentClassStudents = []; // [{id, name, picked}]
let studentsUnsub = null;

// =====================================================
// LOGIN / SIGNUP TAB SWITCHING
// =====================================================
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

// =====================================================
// SIGN UP
// =====================================================
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

// =====================================================
// LOG IN
// =====================================================
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

// =====================================================
// AUTH STATE — routes between login and dashboard
// =====================================================
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
    if (studentsUnsub) studentsUnsub();
  }
});

// =====================================================
// CLASS LIST — load all classes owned by this teacher
// =====================================================
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

// =====================================================
// CREATE NEW CLASS
// =====================================================
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

// =====================================================
// OPEN CLASS DETAIL + RANDOM PICKER
// =====================================================
function openClassDetail(classId) {
  currentClassId = classId;

  db.collection("classes").doc(classId).get().then((doc) => {
    if (!doc.exists) return;
    const data = doc.data();
    detailClassName.textContent = data.name;
    detailClassCode.textContent = data.code;

    const link = `${window.location.origin}${window.location.pathname.replace("picker.html", "index.html")}?class=${data.code}`;
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
  if (studentsUnsub) studentsUnsub();
  currentClassId = null;
  classDetailCard.classList.add("hidden");
  classListCard.classList.remove("hidden");
});

function listenToClassStudents(classId) {
  if (studentsUnsub) studentsUnsub();

  studentsUnsub = db.collection("classes").doc(classId).collection("students")
    .onSnapshot((snapshot) => {
      currentClassStudents = [];
      snapshot.forEach((doc) => {
        currentClassStudents.push({ id: doc.id, ...doc.data() });
      });
      currentClassStudents.sort((a, b) => Number(a.id) - Number(b.id));
      renderPickerState();
    });
}

// =====================================================
// RANDOM PICKER LOGIC
// =====================================================
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
    await db.collection("classes").doc(currentClassId)
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
    const ref = db.collection("classes").doc(currentClassId).collection("students").doc(s.id);
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
// UTILS
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