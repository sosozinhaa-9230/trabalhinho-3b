const getId = (id) => document.querySelector(id);

const welcomeTextEl = getId('#log-in-menu h1');

if (!localStorage.getItem('hasVisited')) {
    localStorage.setItem('hasVisited', 'true');
    welcomeTextEl.innerHTML = 'Bem vind@, crie sua conta para guardar seu progresso'
} else {
    welcomeTextEl.innerHTML = 'Crie sua conta ou entre em uma já existente'
}



const authSection = document.querySelector("#log-in-menu");
const gameSection = document.querySelector("#game-section");
const messageEl = document.querySelector("#message");

async function api(method, url, body) {
    const options = {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
    };
    if (body !== undefined) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const data = await response.json().catch(() => null);

    if (!response.ok) {
        throw new Error((data && data.error) || `Request failed (${response.status})`);
    }
    return data;
}

function showLoggedIn(username) {
    getId("#who").textContent = username;
    authSection.hidden = true;
    gameSection.hidden = false;
}

function showLoggedOut() {
    authSection.hidden = false;
    gameSection.hidden = true;
}

getId("#register-btn").addEventListener("click", async () => {
    try {
        await api("POST", "/register", {
        username: getId("#username").value,
        password: getId("#password").value,
        });
        console.log("user registered")
    } catch (err) {
        console.log(err.message)
    }
});

getId("#login-btn").addEventListener("click", async () => {
  try {
    await api("POST", "/login", {
      username: getId("#username").value,
      password: getId("#password").value,
    });
    const me = await api("GET", "/me");
    getId("#password").value = "";
    showLoggedIn(me.username);
    showMessage("Logged in.");
  } catch (err) {
    showMessage(err.message, true);
  }
});

getId("#save-btn").addEventListener("click", async () => {
  try {
    const gameState = {
      level: Number(getId("#level").value),
      weapon: getId("#weapon").value,
    };
    await api("PUT", "/save", gameState);
    showMessage("Saved.");
  } catch (err) {
    showMessage(err.message, true);
  }
});

getId("#load-btn").addEventListener("click", async () => {
  try {
    const data = await api("GET", "/save");
    if (data === null) {
      showMessage("No save found yet.");
      return;
    }
    $("level").value = data.level ?? 1;
    $("weapon").value = data.weapon ?? "pistol";
    showMessage("Loaded.");
  } catch (err) {
    showMessage(err.message, true);
  }
});

getId("#logout-btn").addEventListener("click", async () => {
  try {
    await api("POST", "/logout");
    showLoggedOut();
    showMessage("Logged out.");
  } catch (err) {
    showMessage(err.message, true);
  }
});

(async function init() {
  try {
    const me = await api("GET", "/me");
    showLoggedIn(me.username);
  } catch {
    showLoggedOut();
  }
})();