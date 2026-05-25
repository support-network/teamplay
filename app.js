import { db, storage } from "./firebase-config.js";
import { 
    collection, addDoc, query, orderBy, onSnapshot, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
    ref, uploadBytes, getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// Состояние приложения
let currentUser = {
    username: localStorage.getItem("tp_username") || "",
    avatar: localStorage.getItem("tp_avatar") || `https://api.dicebear.com/7.x/bottts/svg?seed=${Math.random()}`
};

// DOM Элементы
const authScreen = document.getElementById("auth-screen");
const appScreen = document.getElementById("app-screen");
const usernameInput = document.getElementById("username-input");
const loginBtn = document.getElementById("login-btn");

const navUsername = document.getElementById("nav-username");
const navAvatar = document.getElementById("nav-avatar");

const chatMessages = document.getElementById("chat-messages");
const chatForm = document.getElementById("chat-form");
const messageInput = document.getElementById("message-input");

const profileUsernameInput = document.getElementById("profile-username-input");
const profileAvatarPreview = document.getElementById("profile-avatar-preview");
const avatarFileInput = document.getElementById("avatar-file-input");
const saveProfileBtn = document.getElementById("save-profile-btn");
const logoutBtn = document.getElementById("logout-btn");

const newsContainer = document.getElementById("news-container");

// Инициализация приложения
function init() {
    if (currentUser.username) {
        showApp();
    } else {
        showAuth();
    }
    setupNavigation();
}

// Переключение экранов
function showAuth() {
    authScreen.classList.add("active");
    appScreen.classList.remove("active");
}

function showApp() {
    authScreen.classList.remove("active");
    appScreen.classList.add("active");
    
    navUsername.textContent = currentUser.username;
    navAvatar.src = currentUser.avatar;
    profileUsernameInput.value = currentUser.username;
    profileAvatarPreview.src = currentUser.avatar;

    // Запускаем прослушивание баз данных
    loadMessages();
    loadNews();
}

// Авторизация по нику
loginBtn.addEventListener("click", () => {
    const name = usernameInput.value.trim();
    if(name.length < 2) return alert("Никнейм должен быть от 2 символов!");
    
    currentUser.username = name;
    currentUser.avatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${name}`;
    
    localStorage.setItem("tp_username", name);
    localStorage.setItem("tp_avatar", currentUser.avatar);
    
    showApp();
});

// Навигация по вкладкам меню
function setupNavigation() {
    document.querySelectorAll(".nav-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));
            
            const target = btn.getAttribute("data-target");
            btn.classList.add("active");
            document.getElementById(target).classList.add("active");

            if(target === "chat-section") scrollChat();
        });
    });
}

// --- РАБОТА С ГЛОБАЛЬНЫМ ЧАТОМ (Firestore) ---
chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = messageInput.value.trim();
    if(!text) return;

    try {
        await addDoc(collection(db, "global_chat"), {
            username: currentUser.username,
            avatar: currentUser.avatar,
            text: text,
            timestamp: serverTimestamp()
        });
        messageInput.value = "";
    } catch (err) {
        console.error("Ошибка отправки:", err);
    }
});

function loadMessages() {
    const q = query(collection(db, "global_chat"), orderBy("timestamp", "asc"));
    onSnapshot(q, (snapshot) => {
        chatMessages.innerHTML = "";
        snapshot.forEach(doc => {
            const data = doc.data();
            const isOwn = data.username === currentUser.username;
            
            const time = data.timestamp ? new Date(data.timestamp.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "...";

            const msgHtml = `
                <div class="message ${isOwn ? 'own-msg' : ''}">
                    <img class="msg-avatar" src="${data.avatar}" alt="Ava">
                    <div class="msg-body">
                        <div class="msg-header">
                            <span class="msg-author">${data.username}</span>
                            <span class="msg-time">${time}</span>
                        </div>
                        <div class="msg-text">${escapeHTML(data.text)}</div>
                    </div>
                </div>
            `;
            chatMessages.insertAdjacentHTML("beforeend", msgHtml);
        });
        scrollChat();
    });
}

function scrollChat() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// --- РАБОТА С НОВОСТЯМИ (Firestore) ---
function loadNews() {
    const q = query(collection(db, "news"), orderBy("timestamp", "desc"));
    onSnapshot(q, (snapshot) => {
        if(snapshot.empty) {
            newsContainer.innerHTML = '<div class="loading">Пока новостей нет. Ожидайте обновлений!</div>';
            return;
        }
        newsContainer.innerHTML = "";
        snapshot.forEach(doc => {
            const data = doc.data();
            const date = data.timestamp ? new Date(data.timestamp.toDate()).toLocaleDateString() : "...";
            const newsHtml = `
                <div class="news-item">
                    <h3>${data.title}</h3>
                    <p>${data.content}</p>
                    <span class="news-date"><i class="fa-solid fa-calendar-days"></i> ${date}</span>
                </div>
            `;
            newsContainer.insertAdjacentHTML("beforeend", newsHtml);
        });
    });
}

// --- УПРАВЛЕНИЕ ПРОФИЛЕМ (Смена аватарки и ника) ---
avatarFileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if(!file) return;

    // Показываем локальное превью
    const reader = new FileReader();
    reader.onload = (event) => profileAvatarPreview.src = event.target.result;
    reader.readAsDataURL(file);

    // Загрузка картинки в Firebase Storage
    const storageRef = ref(storage, `avatars/${currentUser.username}_${Date.now()}`);
    try {
        saveProfileBtn.disabled = true;
        saveProfileBtn.textContent = "Загрузка аватара...";
        
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);
        
        currentUser.avatar = downloadURL;
        saveProfileBtn.disabled = false;
        saveProfileBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Сохранить изменения';
    } catch (error) {
        alert("Не удалось загрузить картинку в хранилище.");
        saveProfileBtn.disabled = false;
    }
});

saveProfileBtn.addEventListener("click", () => {
    const newName = profileUsernameInput.value.trim();
    if(newName.length < 2) return alert("Никнейм слишком короткий!");
    
    currentUser.username = newName;
    localStorage.setItem("tp_username", newName);
    localStorage.setItem("tp_avatar", currentUser.avatar);
    
    // Обновляем шапку
    navUsername.textContent = currentUser.username;
    navAvatar.src = currentUser.avatar;
    
    alert("Профиль успешно сохранен!");
});

logoutBtn.addEventListener("click", () => {
    localStorage.clear();
    location.reload();
});

// Защита от XSS
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

init();
