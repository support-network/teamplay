import { db, storage } from "./firebase-config.js";
import { 
    collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, 
    doc, updateDoc, deleteDoc, setDoc, getDocs
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
    ref, uploadBytes, getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// Состояние приложения
let currentUser = {
    username: localStorage.getItem("tp_username") || "",
    avatar: localStorage.getItem("tp_avatar") || `https://api.dicebear.com/7.x/bottts/svg?seed=${Math.random()}`
};

let editingMessageId = null; 
let typingTimeout = null;

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
const chatFileInput = document.getElementById("chat-file-input");
const sendMsgBtn = document.getElementById("send-msg-btn");
const typingIndicator = document.getElementById("typing-indicator");
const editPanel = document.getElementById("edit-panel");
const cancelEditBtn = document.getElementById("cancel-edit-btn");

const profileUsernameInput = document.getElementById("profile-username-input");
const profileAvatarPreview = document.getElementById("profile-avatar-preview");
const avatarFileInput = document.getElementById("avatar-file-input");
const saveProfileBtn = document.getElementById("save-profile-btn");
const logoutBtn = document.getElementById("logout-btn");

const newsContainer = document.getElementById("news-container");

function init() {
    if (currentUser.username) {
        showApp();
    } else {
        showAuth();
    }
    setupNavigation();
}

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

    loadMessages();
    loadNews();
    listenTypingStatus();
}

loginBtn.addEventListener("click", () => {
    const name = usernameInput.value.trim();
    if(name.length < 2) return alert("Никнейм должен быть от 2 символов!");
    
    currentUser.username = name;
    currentUser.avatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${name}`;
    
    localStorage.setItem("tp_username", name);
    localStorage.setItem("tp_avatar", currentUser.avatar);
    
    showApp();
});

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

// --- ЧАТ ЛОГИКА (ОТПРАВКА, ИЗМЕНЕНИЕ, УДАЛЕНИЕ, ФАЙЛЫ) ---

// Логика ввода текста и отправки
chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = messageInput.value.trim();
    
    if(!text && !editingMessageId) return;

    // Сбрасываем статус печатания
    updateTypingStatus(false);

    if (editingMessageId) {
        // Редактирование
        try {
            await updateDoc(doc(db, "global_chat", editingMessageId), {
                text: text,
                isEdited: true
            });
            exitEditMode();
        } catch (err) { console.error(err); }
    } else {
        // Обычная отправка сообщения
        try {
            await addDoc(collection(db, "global_chat"), {
                username: currentUser.username,
                avatar: currentUser.avatar,
                text: text,
                fileUrl: "",
                fileName: "",
                fileType: "",
                isRead: false,
                timestamp: serverTimestamp()
            });
            messageInput.value = "";
        } catch(err) { console.error(err); }
    }
});

// Отправка фотографий/файлов
chatFileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if(!file) return;

    const storageRef = ref(storage, `chat_files/${Date.now()}_${file.name}`);
    try {
        sendMsgBtn.disabled = true;
        messageInput.placeholder = "Файл загружается...";
        
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);
        
        await addDoc(collection(db, "global_chat"), {
            username: currentUser.username,
            avatar: currentUser.avatar,
            text: messageInput.value.trim() || `Отправлен файл: ${file.name}`,
            fileUrl: downloadURL,
            fileName: file.name,
            fileType: file.type,
            isRead: false,
            timestamp: serverTimestamp()
        });
        
        messageInput.value = "";
        messageInput.placeholder = "Напишите сообщение...";
        sendMsgBtn.disabled = false;
        chatFileInput.value = "";
    } catch(err) {
        alert("Ошибка загрузки файла.");
        sendMsgBtn.disabled = false;
    }
});

// Загрузка сообщений и обновление статуса прочтения (галочки)
function loadMessages() {
    const q = query(collection(db, "global_chat"), orderBy("timestamp", "asc"));
    onSnapshot(q, (snapshot) => {
        chatMessages.innerHTML = "";
        snapshot.forEach(async (msgDoc) => {
            const data = msgDoc.data();
            const id = msgDoc.id;
            const isOwn = data.username === currentUser.username;
            
            // Если чужое сообщение не прочитано, помечаем его как прочитанное
            if (!isOwn && !data.isRead) {
                updateDoc(doc(db, "global_chat", id), { isRead: true });
            }

            const time = data.timestamp ? new Date(data.timestamp.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "...";
            
            // Формируем галочки: одна галочка ✓, две зеленых ✓✓
            const statusHtml = isOwn ? (data.isRead ? '<span class="msg-status read"><i class="fa-solid fa-check-double"></i></span>' : '<span class="msg-status"><i class="fa-solid fa-check"></i></span>') : '';
            const editedHtml = data.isEdited ? '<span class="msg-edited">(изм.)</span>' : '';

            // Обработка медиаконтента
            let mediaHtml = "";
            if(data.fileUrl) {
                if(data.fileType && data.fileType.startsWith("image/")) {
                    mediaHtml = `<img src="${data.fileUrl}" class="chat-image" alt="img" onclick="window.open('${data.fileUrl}')">`;
                } else {
                    mediaHtml = `<a href="${data.fileUrl}" target="_blank" class="chat-file-link"><i class="fa-solid fa-file-arrow-down"></i> ${data.fileName}</a>`;
                }
            }

            const msgHtml = `
                <div class="message ${isOwn ? 'own-msg' : ''}" data-id="${id}">
                    <img class="msg-avatar" src="${data.avatar}" alt="Ava">
                    <div class="msg-body">
                        <div class="msg-header">
                            <span class="msg-author">${data.username}</span>
                            <span class="msg-time">${time}</span>
                            ${editedHtml}
                            ${statusHtml}
                        </div>
                        <div class="msg-text">${escapeHTML(data.text)}</div>
                        ${mediaHtml}
                    </div>
                    ${isOwn ? `
                    <div class="msg-actions">
                        <button class="action-btn edit-btn" onclick="enterEditMode('${id}', '${data.text.replace(/'/g, "\\'")}')"><i class="fa-solid fa-pen"></i></button>
                        <button class="action-btn del-btn" onclick="deleteMessage('${id}')"><i class="fa-solid fa-trash"></i></button>
                    </div>` : ''}
                </div>
            `;
            chatMessages.insertAdjacentHTML("beforeend", msgHtml);
        });
        scrollChat();
    });
}

// Экспорт функций глобально, чтобы инлайн HTML-кнопки (onclick) их видели
window.enterEditMode = function(id, text) {
    editingMessageId = id;
    messageInput.value = text;
    editPanel.style.display = "flex";
    messageInput.focus();
}

window.deleteMessage = async function(id) {
    if(confirm("Удалить это сообщение для всех?")) {
        try { await deleteDoc(doc(db, "global_chat", id)); } catch(e) { console.error(e); }
    }
}

function exitEditMode() {
    editingMessageId = null;
    messageInput.value = "";
    editPanel.style.display = "none";
}
cancelEditBtn.addEventListener("click", exitEditMode);

function scrollChat() { chatMessages.scrollTop = chatMessages.scrollHeight; }

// --- КТО ПЕЧАТАЕТ СИСТЕМА ---
messageInput.addEventListener("input", () => {
    updateTypingStatus(true);
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => updateTypingStatus(false), 2000);
});

async function updateTypingStatus(isTyping) {
    if(!currentUser.username) return;
    await setDoc(doc(db, "typing_status", currentUser.username), {
        username: currentUser.username,
        isTyping: isTyping,
        timestamp: serverTimestamp()
    });
}

function listenTypingStatus() {
    onSnapshot(collection(db, "typing_status"), (snapshot) => {
        let typers = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.isTyping && data.username !== currentUser.username) {
                typers.push(data.username);
            }
        });
        if(typers.length > 0) {
            typingIndicator.textContent = typers.join(", ") + (typers.length === 1 ? " печатает..." : " печатают...");
        } else {
            typingIndicator.textContent = "";
        }
    });
}

// --- НОВОСТИ (Автодобавление вашей новости) ---
async function loadNews() {
    // Автоматическая публикация запрашиваемой новости в базу данных (если её там ещё нет)
    const newsRef = collection(db, "news");
    const snapshotCheck = await getDocs(newsRef);
    let hasMainNews = false;
    snapshotCheck.forEach(d => {
        if(d.data().title?.includes("TeamPlay - Web начал")) hasMainNews = true;
    });

    if(!hasMainNews) {
        await addDoc(newsRef, {
            title: "TeamPlay - Web начал полноценную работоспособность",
            content: "Рады сообщить, что веб-версия нашей платформы полностью запущена и готова помогать вам со всеми возникающими техническими и игровыми проблемами. Приятного общения!",
            timestamp: serverTimestamp()
        });
    }

    // Слушатель новостей в реальном времени
    const q = query(newsRef, orderBy("timestamp", "desc"));
    onSnapshot(q, (snapshot) => {
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

// --- УПРАВЛЕНИЕ ПРОФИЛЕМ ---
avatarFileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if(!file) return;

    const reader = new FileReader();
    reader.onload = (event) => profileAvatarPreview.src = event.target.result;
    reader.readAsDataURL(file);

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
        alert("Ошибка хранилища.");
        saveProfileBtn.disabled = false;
    }
});

saveProfileBtn.addEventListener("click", () => {
    const newName = profileUsernameInput.value.trim();
    if(newName.length < 2) return alert("Никнейм слишком короткий!");
    currentUser.username = newName;
    localStorage.setItem("tp_username", newName);
    localStorage.setItem("tp_avatar", currentUser.avatar);
    navUsername.textContent = currentUser.username;
    navAvatar.src = currentUser.avatar;
    alert("Профиль сохранен!");
});

logoutBtn.addEventListener("click", async () => {
    await updateTypingStatus(false);
    localStorage.clear();
    location.reload();
});

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

init();
