/* =========================================
   DOM ELEMENTS
   ========================================= */
// Screens
const menuScreen = document.getElementById('menu-screen');
const quizScreen = document.getElementById('quiz-screen');
const resultScreen = document.getElementById('result-screen');

// Menu
const menuMessage = document.getElementById('menu-message');
const menuGrid = document.getElementById('menu-grid');

// Quiz Interface
const quizTitle = document.getElementById('quiz-title');
const questionCounter = document.getElementById('question-counter');
const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const btnReturnMenu = document.getElementById('btn-return-menu');

// Result Interface
const resDayTitle = document.getElementById('result-day-title');
const resCorrect = document.getElementById('res-correct');
const resWrong = document.getElementById('res-wrong');
const resUnattempted = document.getElementById('res-unattempted');
const btnResultMenu = document.getElementById('btn-result-menu');

// Dialog Overlay
const dialogOverlay = document.getElementById('dialog-overlay');
const dialogTitle = document.getElementById('dialog-title');
const dialogMessage = document.getElementById('dialog-message');
const dialogBtn1 = document.getElementById('dialog-btn-1');
const dialogBtn2 = document.getElementById('dialog-btn-2');
const dialogBtnCancel = document.getElementById('dialog-btn-cancel');

/* =========================================
   STATE VARIABLES & STORAGE INITIALIZATION
   ========================================= */
const STORAGE_KEY = 'pyq_practice_data';
let allQuizData = [];
let progressData = {};

// Safely initialize localStorage to prevent fatal crashes on strict browsers
try {
    const storedData = localStorage.getItem(STORAGE_KEY);
    if (storedData) {
        progressData = JSON.parse(storedData);
    }
} catch (e) {
    console.warn("LocalStorage access denied or data corrupted. Progress will only save for this session.");
    progressData = {};
}

let currentDayData = null;
let currentDayKey = null;
let currentQuestionIndex = 0;
let isReviewMode = false;

/* =========================================
   INITIALIZATION & DATA FETCHING
   ========================================= */
async function init() {
    menuMessage.textContent = 'Loading questions...';
    menuMessage.classList.remove('error');
    
    try {
        const response = await fetch('arranged_sets.json');
        
        // Strict fetch validation (Mistake #4 fixed)
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        allQuizData = await response.json();
        menuMessage.textContent = ''; // Clear loading message on success
        renderMenu();
        
    } catch (error) {
        menuMessage.textContent = 'Error loading arranged_sets.json. Make sure the file exists and you are running a local server.';
        menuMessage.classList.add('error');
        console.error("Data load error:", error);
    }
}

// Safely save to localStorage
function saveProgress() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(progressData));
    } catch (e) {
        console.warn("Could not save to localStorage.");
    }
}

// Utility to switch screens smoothly
function showScreen(screenElement) {
    [menuScreen, quizScreen, resultScreen].forEach(s => {
        s.classList.remove('active');
        s.classList.add('hidden');
    });
    
    screenElement.classList.remove('hidden');
    screenElement.classList.add('active');
    
    window.scrollTo(0, 0); // Scroll to top when changing screens
}

/* =========================================
   MENU SYSTEM
   ========================================= */
function getVibrantColor(index) {
    // Uses the Golden Angle to generate distinct, vibrant colors that look great in dark mode
    const hue = (index * 137.508) % 360;
    return `hsl(${hue}, 75%, 35%)`; 
}

function renderMenu() {
    menuGrid.innerHTML = '';
    
    allQuizData.forEach((dayObj, index) => {
        const dayKey = 'day_' + dayObj.day;
        const record = progressData[dayKey];
        
        let statusText = 'Not Started';
        if (record) {
            statusText = record.status === 'completed' ? 'Completed' : 'In Progress';
        }

        const block = document.createElement('div');
        block.className = 'day-block';
        block.style.backgroundColor = getVibrantColor(index);
        
        block.innerHTML = `
            <span>${dayObj.title}</span>
            <span class="day-status">${statusText}</span>
        `;
        
        block.addEventListener('click', () => handleDayClick(dayObj));
        menuGrid.appendChild(block);
    });
}

function handleDayClick(dayObj) {
    const dayKey = 'day_' + dayObj.day;
    const record = progressData[dayKey];

    if (!record || record.status === undefined) {
        // Never played before -> start directly
        startQuiz(dayObj, 'new');
    } else if (record.status === 'in-progress') {
        showDialog(
            'Quiz In Progress', 
            `You left ${dayObj.title} halfway.`, 
            'Resume', () => startQuiz(dayObj, 'resume'),
            'Restart', () => startQuiz(dayObj, 'restart')
        );
    } else if (record.status === 'completed') {
        showDialog(
            'Quiz Completed', 
            `You have already finished ${dayObj.title}.`, 
            'Review', () => startQuiz(dayObj, 'review'),
            'Restart', () => startQuiz(dayObj, 'restart')
        );
    }
}

/* =========================================
   DIALOG OVERLAY LOGIC
   ========================================= */
function showDialog(title, message, btn1Text, btn1Callback, btn2Text, btn2Callback) {
    dialogTitle.textContent = title;
    dialogMessage.textContent = message;
    
    dialogBtn1.textContent = btn1Text;
    dialogBtn1.onclick = () => { closeDialog(); btn1Callback(); };
    
    dialogBtn2.textContent = btn2Text;
    dialogBtn2.onclick = () => { closeDialog(); btn2Callback(); };
    
    dialogBtnCancel.onclick = closeDialog;
    
    dialogOverlay.classList.remove('hidden');
}

function closeDialog() {
    dialogOverlay.classList.add('hidden');
}

/* =========================================
   QUIZ LOGIC
   ========================================= */
function startQuiz(dayObj, mode) {
    currentDayData = dayObj;
    currentDayKey = 'day_' + dayObj.day;
    isReviewMode = (mode === 'review');

    // Create fresh progress record if it's new or resetting
    if (mode === 'new' || mode === 'restart') {
        progressData[currentDayKey] = {
            status: 'in-progress',
            answers: {}, // Stores user answers: { index: "A" }
            lastIndex: 0
        };
        saveProgress();
    }
    
    const record = progressData[currentDayKey];
    
    // Set starting index
    if (mode === 'resume') {
        currentQuestionIndex = record.lastIndex || 0;
    } else {
        currentQuestionIndex = 0;
    }

    quizTitle.textContent = currentDayData.title + (isReviewMode ? " (Review)" : "");
    showScreen(quizScreen);
    renderQuestion();
}

function renderQuestion() {
    const questionObj = currentDayData.questions[currentQuestionIndex];
    const totalQ = currentDayData.total_questions;
    const record = progressData[currentDayKey];
    
    // Update top bar stats
    questionCounter.textContent = `${currentQuestionIndex + 1} / ${totalQ}`;
    
    // Handle Previous button state
    btnPrev.disabled = (currentQuestionIndex === 0);
    
    // Handle Next/Done button text
    if (currentQuestionIndex === totalQ - 1) {
        btnNext.textContent = 'Done';
    } else {
        btnNext.textContent = 'Next';
    }

    // Populate question text
    questionText.textContent = questionObj.question;
    
    // Clear and build options
    optionsContainer.innerHTML = '';
    const hasAnswered = record.answers.hasOwnProperty(currentQuestionIndex);
    const userAnswer = record.answers[currentQuestionIndex];
    
    // Create Option Buttons (A, B, C, D)
    for (const [key, value] of Object.entries(questionObj.options)) {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.textContent = `${key}. ${value}`;
        
        // If already answered in the past (or reviewing), apply styling immediately
        if (hasAnswered) {
            btn.disabled = true; // Lock the button
            if (key === questionObj.correct_option) {
                btn.classList.add('correct');
            } else if (key === userAnswer) {
                // The user picked this one previously and it was wrong
                btn.classList.add('wrong');
            }
        } else {
            // Unanswered state logic
            btn.onclick = () => selectOption(key, btn);
        }
        
        optionsContainer.appendChild(btn);
    }
    
    // Logic constraint: Must answer before moving to next question (unless reviewing a skipped question)
    if (!hasAnswered && !isReviewMode) {
        btnNext.disabled = true;
    } else {
        btnNext.disabled = false;
    }
    
    // Auto-scroll question area to top for long questions
    document.getElementById('question-area').scrollTop = 0;
}

function selectOption(selectedKey, clickedBtn) {
    // SECURITY FIX (Mistake #5): Prevent overwriting data if just reviewing
    if (isReviewMode) return; 

    const record = progressData[currentDayKey];
    const questionObj = currentDayData.questions[currentQuestionIndex];
    
    // Double check to prevent multiple clicks bug
    if (record.answers.hasOwnProperty(currentQuestionIndex)) return;
    
    // Save user's answer
    record.answers[currentQuestionIndex] = selectedKey;
    record.lastIndex = currentQuestionIndex;
    saveProgress();
    
    // Get all option buttons currently on screen
    const allBtns = optionsContainer.querySelectorAll('.option-btn');
    
    // Apply visual Right/Wrong feedback
    allBtns.forEach(btn => {
        btn.disabled = true; // Lock all buttons
        
        // Extract the first character ("A", "B", etc.) to match the key
        const optKey = btn.textContent.charAt(0);
        
        if (optKey === questionObj.correct_option) {
            btn.classList.add('correct');
        } else if (optKey === selectedKey) {
            btn.classList.add('wrong');
        }
    });
    
    // Unlock Next Button now that they answered
    btnNext.disabled = false;
}

/* =========================================
   NAVIGATION EVENT LISTENERS
   ========================================= */
btnNext.addEventListener('click', () => {
    const totalQ = currentDayData.total_questions;
    
    if (currentQuestionIndex < totalQ - 1) {
        currentQuestionIndex++;
        // Update the 'resume point'
        if (!isReviewMode) {
            progressData[currentDayKey].lastIndex = currentQuestionIndex;
            saveProgress();
        }
        renderQuestion();
    } else {
        // Reached the end -> Clicked 'Done'
        if (!isReviewMode) {
            progressData[currentDayKey].status = 'completed';
            saveProgress();
        }
        showResults();
    }
});

btnPrev.addEventListener('click', () => {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        if (!isReviewMode) {
            progressData[currentDayKey].lastIndex = currentQuestionIndex;
            saveProgress();
        }
        renderQuestion();
    }
});

// Return to menu buttons
btnReturnMenu.addEventListener('click', () => {
    renderMenu(); // Refresh statuses on the menu
    showScreen(menuScreen);
});

btnResultMenu.addEventListener('click', () => {
    renderMenu(); // Refresh statuses on the menu
    showScreen(menuScreen);
});

/* =========================================
   RESULTS LOGIC
   ========================================= */
function showResults() {
    const record = progressData[currentDayKey];
    let correctCount = 0;
    let wrongCount = 0;
    let unattemptedCount = 0;
    
    // Calculate stats accurately
    currentDayData.questions.forEach((qObj, index) => {
        const userAnswer = record.answers[index];
        if (!userAnswer) {
            unattemptedCount++;
        } else if (userAnswer === qObj.correct_option) {
            correctCount++;
        } else {
            wrongCount++;
        }
    });
    
    resDayTitle.textContent = currentDayData.title;
    resCorrect.textContent = correctCount;
    resWrong.textContent = wrongCount;
    resUnattempted.textContent = unattemptedCount;
    
    showScreen(resultScreen);
}

// Start the app when the file loads!
window.onload = init;