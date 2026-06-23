// =====================================================
// SMART STUDENT ID & RANDOM PICKER — MERGED APP LOGIC
// (Combines former App.js + Picker.js into one file,
// since both Student and Teacher sections now live on
// the same index.html page.)
// =====================================================

// -----------------------------------------------------
// TEACHER EMAIL ALLOWLIST
// Only emails listed here are allowed to create a teacher
// account. Add the email address(es) of every teacher who
// should have access, comma-separated.
// -----------------------------------------------------
const ALLOWED_TEACHER_EMAILS = [
  "ammasivilmar2@gmail.com"
  // add more teacher emails here, comma-separated
];

// -----------------------------------------------------
// SHARED PICKER TIMING
// Used by both the teacher's picker button and the student's
// live-watch view, so the animation feels consistent everywhere.
// 38 ticks * 80ms = ~3.04 seconds, satisfying the 3-second minimum.
// -----------------------------------------------------
const SHUFFLE_TICK_MS = 80;
const SHUFFLE_TICKS = 38;

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
  showRoleSelect();
});
teacherBackBtn.addEventListener("click", () => {
  if (teacherStudentsUnsub) teacherStudentsUnsub();
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

let currentClassId = null;

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
  } catch (err) {
    classCodeMsg.textContent = "Could not search right now. " + (navigator.onLine ? err.message : "You appear to be offline — try again once connected.");
    classCodeMsg.classList.add("error");
  } finally {
    findClassBtn.disabled = false;
    findClassBtn.textContent = "Find Class";
  }
}

backToCodeBtn.addEventListener("click", () => {
  currentClassId = null;
  registerCard.classList.add("hidden");
  classCodeCard.classList.remove("hidden");
  classCodeInput.value = "";
  classCodeMsg.textContent = "";
  idInput.value = "";
  nameInput.value = "";
  registerMsg.textContent = "";
});

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
    showWatchPicker();
  } catch (err) {
    if (err.message === "ID_TAKEN") {
      registerMsg.textContent = "ID already taken. Please choose a different number.";
    } else if (!navigator.onLine) {
      registerMsg.textContent = "You're offline — registration saved locally and will sync once you're back online.";
      registerMsg.classList.add("success");
      idInput.value = "";
      nameInput.value = "";
      showWatchPicker();
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
// LIVE PICKER VIEWER (student side)
// Shown automatically right after registration. Listens to
// the same students/ subcollection the teacher's picker writes
// to, and plays the SAME claw machine animation whenever ANY
// student's `picked` flag flips from false -> true — so the
// whole class can watch picks happen live, for as long as
// they stay on this screen.
// -----------------------------------------------------
const watchPickerCard = document.getElementById("watchPickerCard");
const watchPickerSub = document.getElementById("watchPickerSub");
const watchPoolCount = document.getElementById("watchPoolCount");
const watchPickerNameDisplay = document.getElementById("watchPickerNameDisplay");
const watchBackBtn = document.getElementById("watchBackBtn");

const watchClawMachine = document.getElementById("watchClawMachine");
const watchClawArm = document.getElementById("watchClawArm");
const watchClawPincer = document.getElementById("watchClawPincer");
const watchEmojiPile = document.getElementById("watchEmojiPile");

let watchPickerUnsub = null;
let knownPickedIds = new Set(); // tracks which IDs we've already animated, so we don't replay on every snapshot
let watchPickerBusy = false; // true while an animation is mid-flight, to queue up any picks that land during it
let pendingPicks = [];
let lastKnownPoolSize = 0;

function showWatchPicker() {
  registerCard.classList.add("hidden");
  watchPickerCard.classList.remove("hidden");
  knownPickedIds = new Set();
  pendingPicks = [];
  watchPickerBusy = false;
  lastKnownPoolSize = 0;

  if (watchPickerUnsub) watchPickerUnsub();
  watchPickerUnsub = db.collection("classes").doc(currentClassId).collection("students")
    .onSnapshot((snapshot) => {
      const total = snapshot.size;
      let pickedCount = 0;
      const newlyPicked = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.picked) {
          pickedCount++;
          if (!knownPickedIds.has(doc.id)) {
            knownPickedIds.add(doc.id);
            newlyPicked.push(data.name);
          }
        }
      });

      const poolSize = total - pickedCount;
      watchPoolCount.textContent = `${poolSize} of ${total} students still in the pool`;

      // Only redraw the resting pile when nothing is mid-animation,
      // so we don't yank emoji out from under an in-progress claw sequence.
      if (!watchPickerBusy && poolSize !== lastKnownPoolSize) {
        renderEmojiPile(watchEmojiPile, poolSize);
      }
      lastKnownPoolSize = poolSize;

      newlyPicked.forEach((name) => pendingPicks.push(name));
      processPendingPicks();
    }, (err) => {
      console.warn("Picker viewer listener error (will retry automatically):", err.message);
    });
}

function processPendingPicks() {
  if (watchPickerBusy || pendingPicks.length === 0) return;

  const name = pendingPicks.shift();
  watchPickerBusy = true;
  watchPickerSub.textContent = "Picking now…";

  playClawSequence(
    { machine: watchClawMachine, arm: watchClawArm, pincer: watchClawPincer, pile: watchEmojiPile, nameDisplay: watchPickerNameDisplay },
    lastKnownPoolSize,
    () => {
      watchPickerNameDisplay.textContent = name;
      watchPickerSub.textContent = "Watching live — stay on this page to see who gets picked.";
      watchPickerBusy = false;
      renderEmojiPile(watchEmojiPile, lastKnownPoolSize); // refresh pile to reflect the pick that just happened
      processPendingPicks(); // chain to the next pick if more came in while animating
    }
  );
}

watchBackBtn.addEventListener("click", () => {
  if (watchPickerUnsub) watchPickerUnsub();
  watchPickerCard.classList.add("hidden");
  classCodeCard.classList.remove("hidden");
  currentClassId = null;
  classCodeInput.value = "";
  classCodeMsg.textContent = "";
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

const idOverviewSub = document.getElementById("idOverviewSub");
const idGrid = document.getElementById("idGrid");

const poolCount = document.getElementById("poolCount");
const pickerNameDisplay = document.getElementById("pickerNameDisplay");
const shuffleBtn = document.getElementById("shuffleBtn");
const resetPoolBtn = document.getElementById("resetPoolBtn");
const studentListDisplay = document.getElementById("studentListDisplay");

const clawMachine = document.getElementById("clawMachine");
const clawArm = document.getElementById("clawArm");
const clawPincer = document.getElementById("clawPincer");
const emojiPile = document.getElementById("emojiPile");

const manualNameInput = document.getElementById("manualNameInput");
const manualAddBtn = document.getElementById("manualAddBtn");
const manualAddMsg = document.getElementById("manualAddMsg");

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

  if (!ALLOWED_TEACHER_EMAILS.includes(email)) {
    signupError.textContent = "This email is not authorized to create a teacher account. Contact the system administrator.";
    return;
  }

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
// MANUALLY ADD A STUDENT (teacher-side)
// Used for walk-ins, classes not self-registering, or quickly
// adding a name without the student doing it themselves. Writes
// to the SAME students/ collection as self-registration, so it's
// indistinguishable to anyone else viewing the class — including
// the live student-watch screen.
// -----------------------------------------------------
manualAddBtn.addEventListener("click", async () => {
  manualAddMsg.textContent = "";
  manualAddMsg.className = "form-msg";

  const name = manualNameInput.value.trim();
  if (!name) {
    manualAddMsg.textContent = "Please enter a name.";
    manualAddMsg.classList.add("error");
    return;
  }
  if (!currentTeacherClassId) return;

  manualAddBtn.disabled = true;

  try {
    // Find the lowest unused ID 1-45 from the currently loaded list.
    const takenIds = new Set(currentClassStudents.map(s => Number(s.id)));
    let nextId = null;
    for (let i = 1; i <= 45; i++) {
      if (!takenIds.has(i)) { nextId = i; break; }
    }

    if (nextId === null) {
      manualAddMsg.textContent = "This class is full (all 45 IDs are taken).";
      manualAddMsg.classList.add("error");
      return;
    }

    const studentRef = db.collection("classes").doc(currentTeacherClassId)
      .collection("students").doc(String(nextId));

    // Same transaction safety as self-registration, in case a student
    // claims this exact ID at the same moment the teacher does.
    await db.runTransaction(async (tx) => {
      const existing = await tx.get(studentRef);
      if (existing.exists) throw new Error("ID_TAKEN");
      tx.set(studentRef, {
        name: name,
        registeredAt: firebase.firestore.FieldValue.serverTimestamp(),
        picked: false
      });
    });

    manualAddMsg.textContent = `Added ${name} as ID ${nextId}.`;
    manualAddMsg.classList.add("success");
    manualNameInput.value = "";
  } catch (err) {
    if (err.message === "ID_TAKEN") {
      manualAddMsg.textContent = "That ID was just taken — please try again.";
    } else {
      manualAddMsg.textContent = "Could not add student: " + err.message;
    }
    manualAddMsg.classList.add("error");
  } finally {
    manualAddBtn.disabled = false;
  }
});

manualNameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    manualAddBtn.click();
  }
});

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
// RANDOM PICKER LOGIC — CLAW MACHINE
// -----------------------------------------------------
function getActivePool() {
  return currentClassStudents.filter(s => !s.picked);
}

// A fixed set of varied emoji so the machine always looks lively
// even with a small pool. Cycled through, not tied to student identity.
const CLAW_EMOJI_SET = ["🐻", "🐱", "🐰", "🦊", "🐼", "🐸", "🦄", "🐯", "🐵", "🐶", "🦁", "🐨", "🐷", "🐹", "🐧"];

function renderPickerState() {
  renderIdGrid();

  const pool = getActivePool();
  poolCount.textContent = `${pool.length} of ${currentClassStudents.length} students in pool`;

  studentListDisplay.innerHTML = currentClassStudents.map(s => `
    <span class="student-tag ${s.picked ? "removed" : ""}">${escapeHtml(s.name)} (#${s.id})</span>
  `).join("");

  renderEmojiPile(emojiPile, pool.length);

  shuffleBtn.disabled = pool.length === 0;
  if (pool.length === 0 && currentClassStudents.length > 0) {
    pickerNameDisplay.textContent = "Everyone has been picked! 🎉";
  }
}

// Shows which of the 45 ID slots are taken — teacher-only view,
// since exposing this to students would let them see which IDs
// are still free and undermine the "assigned ID" fairness rule.
function renderIdGrid() {
  const takenIds = new Set(currentClassStudents.map(s => Number(s.id)));
  idOverviewSub.textContent = `${takenIds.size} of 45 students registered`;
  let html = "";
  for (let i = 1; i <= 45; i++) {
    const taken = takenIds.has(i);
    html += `<div class="id-chip ${taken ? "taken" : ""}">${i}</div>`;
  }
  idGrid.innerHTML = html;
}

// Renders N bouncing emoji into a pile container, spaced out
// randomly so they look scattered inside the glass, not gridded.
function renderEmojiPile(pileEl, count) {
  if (!pileEl) return;
  let html = "";
  for (let i = 0; i < count; i++) {
    const emoji = CLAW_EMOJI_SET[i % CLAW_EMOJI_SET.length];
    const left = 8 + Math.random() * 80; // % from left, kept inside the glass
    const bottom = 6 + Math.random() * 55; // % from bottom, piled toward the base
    const delay = (Math.random() * 1.8).toFixed(2);
    html += `<span class="pile-emoji" data-index="${i}" style="left:${left}%; bottom:${bottom}%; animation-delay:${delay}s;">${emoji}</span>`;
  }
  pileEl.innerHTML = html;
}

shuffleBtn.addEventListener("click", () => {
  const pool = getActivePool();
  if (pool.length === 0) return;

  shuffleBtn.disabled = true;
  playClawSequence(
    { machine: clawMachine, arm: clawArm, pincer: clawPincer, pile: emojiPile, nameDisplay: pickerNameDisplay },
    pool.length,
    () => finalizePick(pool)
  );
});

async function finalizePick(pool) {
  // Final random selection using the exact logic from the spec
  const selectedIndex = Math.floor(Math.random() * pool.length);
  const selected = pool[selectedIndex];

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
    pickerNameDisplay.textContent = "Press the button to play!";
  } catch (err) {
    alert("Could not reset pool: " + err.message);
  }
});

// -----------------------------------------------------
// SHARED CLAW ANIMATION SEQUENCE
// Drives the arm sliding to a random spot, dropping, "grabbing"
// an emoji, lifting it out, and sliding back to center — timed
// to land at or beyond SHUFFLE_TICKS * SHUFFLE_TICK_MS (~3s).
// Calls onComplete once the visual sequence finishes, so the
// caller can reveal the real picked name right after.
// -----------------------------------------------------
function playClawSequence(els, poolSize, onComplete) {
  const { arm, pincer, pile, nameDisplay } = els;
  const totalDurationMs = SHUFFLE_TICKS * SHUFFLE_TICK_MS; // ~3 seconds, matches existing timing elsewhere

  nameDisplay.textContent = "Picking…";

  // Pick a random visible emoji in the pile to "target"
  const emojiEls = pile ? Array.from(pile.querySelectorAll(".pile-emoji")) : [];
  const targetEl = emojiEls.length > 0 ? emojiEls[Math.floor(Math.random() * emojiEls.length)] : null;
  const targetLeftPercent = targetEl ? parseFloat(targetEl.style.left) : 50;

  // Stage 1 (0 - 35%): arm slides horizontally to the target's X position
  arm.style.left = `${targetLeftPercent}%`;

  setTimeout(() => {
    // Stage 2 (35% - 55%): claw drops down into the glass
    arm.classList.add("lifting");
    const cable = arm.querySelector(".claw-cable");
    if (cable) cable.style.height = "150px";
    pincer.classList.remove("open");

    setTimeout(() => {
      // Stage 3 (55% - 65%): "grab" — mark the targeted emoji as caught
      if (targetEl) {
        targetEl.classList.add("grabbed");
        targetEl.style.bottom = "calc(150px)"; // visually rides up with the claw
      }
      pincer.classList.add("open");

      setTimeout(() => {
        // Stage 4 (65% - 85%): lift back up to the rail
        if (cable) cable.style.height = "30px";
        if (targetEl) targetEl.classList.add("removed");

        setTimeout(() => {
          // Stage 5 (85% - 100%): slide back to center, then reveal
          arm.classList.remove("lifting");
          arm.style.left = "50%";

          setTimeout(() => {
            onComplete();
          }, totalDurationMs * 0.15);
        }, totalDurationMs * 0.2);
      }, totalDurationMs * 0.1);
    }, totalDurationMs * 0.2);
  }, totalDurationMs * 0.35);
}

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
