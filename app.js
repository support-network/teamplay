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

// Наборы премиальных iOS смайликов по категориям
const emojiCategories = {
    "😀": ["😀","😃","😄","😁","😆","😅","😂","🤣","😊","😇","🙂","🙃","😉","😌","😍","🥰","😘","😗","😙","😚","😋","😛","😝","😜","🤪","🤨","🧐","🤓","😎","🤩","🥳","😏","😒","😞","😔","😟","😕","🙁","☹️","😣","😖","😫","😩","🥺","😢","😭","😤","😠","😡","🤬","🤯","😳","🥵","🥶","😱","😨","😰","😥","😓","🤗","🤔","🤭","🤫","🤥","😶","😐","😑","😬","🙄","😯","😦","😧","😮","😲","🥱","😴","🤤","😪","😵","🤐","🥴","🤢","🤮","🤧","😷","🤒","🤕"],
    "🍕": ["🍏","🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓"," melon","🍒","🍑","🥭","🍍","🥥","🥝","🍅","🍆","🥑","🥦","🥬","🥒","🌶","🌽","🥕"," garlic","🧅","🥔","🍠","🥐","🥯","🍞","🥖","🥨","🧀","🥚","🍳","🥞","🧇","🥓","🥩","🍗","🍖","🌭","🍔","🍟","🍕","🥪","🥙","🧆","🌮","🌯","🥗","🍿","🧈","🧂","🥫"],
    "🚗": ["🚗","🚕","🚙","🚌","🚎","🏎","🚑","🚒","🚓","🚍","🚘","🚖","🚡","🚠","🚟","🚃","🚋","🚂","🚆","🚇","🚊","🚉","✈️","🛫","🛬","🛩","🛸","🚁","🛶","⛵️","🚤","🛥","🛳","🚢","⚓️","🚀","🛸"],
    "💡": ["⌚️","📱","📲","💻","⌨️","🖥","🖨","🖱","🖲","🕹","🗜","💽"," floppy","💾","💿","📀","📼","📷","📸","📹","🎥","📽","🎞","📞","📟","📠","📺","📻","🎙","🎚","🎛","🧭","⏱","⏲","⏰","🕵️‍♂️","💡","🔦","🕯","💵","💎"],
    "❤️": ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💘","💝","💟","☮️","✝️","☪️","🕉","☸️","✡️","🔯","🕎","☯️","☦️","🛐","⛎","♈️","♉️","♊️","♋️","♌️","♍️","♎️","♏️","♐️","♑️","♒️","♓️","🆔"]
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
const chatFileInput = document.getElementById("chat-file-input");
const sendMsgBtn = document.getElementById("send-msg-btn");
const typingIndicator = document.getElementById("typing-indicator");
const editPanel = document.getElementById("edit-panel");
const cancelEditBtn = document.getElementById("cancel-edit-btn");

const emojiToggleBtn = document.getElementById("emoji-toggle-btn");
const emojiPicker = document.getElementById("emoji-picker");
const emojiListContainer = document.getElementById("emoji-list-container");

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
    setupEmojiPicker();
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

            emojiPicker.style.display = "none";
            if(target === "chat-section") scrollChat();
        });
    });
}

// --- ИНТЕГРАЦИЯ iOS СМАЙЛИКОВ ---
function setupEmojiPicker() {
    // Переключение видимости клавиатуры смайлов
    emojiToggleBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        emojiPicker.style.display = emojiPicker.style.display === "none" ? "flex" : "none";
    });

    // Закрытие при клике по пустой области
    document.addEventListener("click", (e) => {
        if(!emojiPicker.contains(e.target) && e.target !== emojiToggleBtn && !emojiToggleBtn.contains(e.target)) {
            emojiPicker.style.display = "none";
        }
    });

    // Рендер дефолтной вкладки смайлов
    renderEmojiTab("😀");

    // Обработка переключения категорий
    document.querySelectorAll(".emoji-tab-item").forEach(tab => {
        tab.addEventListener("click", (e) => {
            document.querySelectorAll(".emoji-tab-item").forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            renderEmojiTab(tab.textContent.trim());
        });
    });
}

function renderEmojiTab(categorySymbol) {
    emojiListContainer.innerHTML = "";
    const list = emojiCategories[categorySymbol] || [];
    list.forEach(emoji => {
        const span = document.createElement("span");
        span.className = "emoji-item";
        span.textContent = emoji;
        span.addEventListener("click", () => {
            // Вставляем смайл в позицию курсора
            const start = messageInput.selectionStart;
            const end = messageInput.selectionEnd;
            const text = messageInput.value;
            messageInput.value = text.substring(0, start) + emoji + text.substring(end);
            messageInput.focus();
            messageInput.selectionStart = messageInput.selectionEnd = start + emoji.length;
            updateTypingStatus(true);
        });
        emojiListContainer.appendChild(span);
    });
}

// --- ЧАТ ОПЕРАЦИИ (FIRESTORE) ---
chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = messageInput.value.trim();
    if(!text && !editingMessageId) return;

    updateTypingStatus(false);
    emojiPicker.style.display = "none";

    if (editingMessageId) {
        try {
            await updateDoc(doc(db, "global_chat", editingMessageId), {
                text: text,
                isEdited: true
            });
            exitEditMode();
        } catch (err) { console.error(err); }
    } else {
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

chatFileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if(!file) return;

    const storageRef = ref(storage, `chat_files/${Date.now()}_${file.name}`);
    try {
        sendMsgBtn.disabled = true;
        messageInput.placeholder = "Компиляция файла в облако...";
        
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);
        
        await addDoc(collection(db, "global_chat"), {
            username: currentUser.username,
            avatar: currentUser.avatar,
            text: messageInput.value.trim() || `Файл: ${file.name}`,
            fileUrl: downloadURL,
            fileName: file.name,
            fileType: file.type,
            isRead: false,
            timestamp: serverTimestamp()
        });
        
        messageInput.value = "";
        messageInput.placeholder = "Напишите что-нибудь...";
        sendMsgBtn.disabled = false;
        chatFileInput.value = "";
    } catch(err) {
        alert("Сбой передачи файла.");
        sendMsgBtn.disabled = false;
    }
});

function loadMessages() {
    const q = query(collection(db, "global_chat"), orderBy("timestamp", "asc"));
    onSnapshot(q, (snapshot) => {
        chatMessages.innerHTML = "";
        snapshot.forEach((msgDoc) => {
            const data = msgDoc.data();
            const id = msgDoc.id;
            const isOwn = data.username === currentUser.username;
            
            if (!isOwn && !data.isRead) {
                updateDoc(doc(db, "global_chat", id), { isRead: true });
            }

            const time = data.timestamp ? new Date(data.timestamp.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "...";
            const statusHtml = isOwn ? (data.isRead ? '<span class="msg-status read"><i class="fa-solid fa-check-double"></i></span>' : '<span class="msg-status"><i class="fa-solid fa-check"></i></span>') : '';
            const editedHtml = data.isEdited ? '<span class="msg-edited">(изм.)</span>' : '';

            let mediaHtml = "";
            if(data.fileUrl) {
                if(data.fileType && data.fileType.startsWith("image/")) {
                    mediaHtml = `<img src="${data.fileUrl}" class="chat-image" alt="img" onclick="window.open('${data.fileUrl}')">`;
                } else {
                    mediaHtml = `<a href="${data.fileUrl}" target="_blank" class="chat-file-link"><i class="fa-solid fa-folder-open"></i> ${data.fileName}</a>`;
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
                        <button class="action-btn" onclick="enterEditMode('${id}', '${data.text.replace(/'/g, "\\'")}')"><i class="fa-solid fa-sliders"></i></button>
                        <button class="action-btn del-btn" onclick="deleteMessage('${id}')"><i class="fa-solid fa-trash-can"></i></button>
                    </div>` : ''}
                </div>
            `;
            chatMessages.insertAdjacentHTML("beforeend", msgHtml);
        });
        scrollChat();
    });
}

window.enterEditMode = function(id, text) {
    editingMessageId = id;
    messageInput.value = text;
    editPanel.style.display = "flex";
    messageInput.focus();
}

window.deleteMessage = async function(id) {
    if(confirm("Аннулировать сообщение для всех участников хаба?")) {
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

// --- СТАТУС ПЕЧАТАНИЯ ---
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
            typingIndicator.textContent = typers.join(", ") + " генерирует текст...";
        } else {
            typingIndicator.textContent = "";
        }
    });
}

// --- ЛЕНТА НОВОСТЕЙ ---
async function loadNews() {
    const newsRef = collection(db, "news");
    const snapshotCheck = await getDocs(newsRef);
    let hasTargetNews = false;
    
    snapshotCheck.forEach(d => {
        if(d.data().title && d.data().title.includes("TeamPlay - Web начал полноценную работоспособность")) {
            hasTargetNews = true;
        }
    });

    if(!hasTargetNews) {
        await addDoc(newsRef, {
            title: "TeamPlay - Web начал полноценную работоспособность и готов помогать вам с проблемами",
            content: "Архитектура ядра полностью стабилизирована. 3D-модуль Glassmorphism развернут успешно. Наша команда инженеров всегда на связи и готова оперативно устранять любые неполадки внутри экосистемы.",
            timestamp: serverTimestamp()
        });
    }

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
                    <span class="news-date"><i class="fa-solid fa-cube"></i> Индекс данных от: ${date}</span>
                </div>
            `;
            newsContainer.insertAdjacentHTML("beforeend", newsHtml);
        });
    });
}

// --- ПРОФИЛЬ ---
avatarFileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if(!file) return;

    const reader = new FileReader();
    reader.onload = (event) => profileAvatarPreview.src = event.target.result;
    reader.readAsDataURL(file);

    const storageRef = ref(storage, `avatars/${currentUser.username}_${Date.now()}`);
    try {
        saveProfileBtn.disabled = true;
        saveProfileBtn.textContent = "Интеграция медиа...";
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);
        currentUser.avatar = downloadURL;
        saveProfileBtn.disabled = false;
        saveProfileBtn.innerHTML = '<i class="fa-solid fa-signature"></i> Зафиксировать изменения';
    } catch (error) {
        alert("Хранилище отклонило запрос.");
        saveProfileBtn.disabled = false;
    }
});

saveProfileBtn.addEventListener("click", () => {
    const newName = profileUsernameInput.value.trim();
    if(newName.length < 2) return alert("Псевдоним слишком короткий!");
    currentUser.username = newName;
    localStorage.setItem("tp_username", newName);
    localStorage.setItem("tp_avatar", currentUser.avatar);
    navUsername.textContent = currentUser.username;
    navAvatar.src = currentUser.avatar;
    alert("Конфигурация ядра обновлена!");
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
